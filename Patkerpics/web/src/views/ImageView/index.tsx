import React, { Component, ReactElement, useState } from 'react';
import { FaCaretLeft, FaCaretRight, FaUserCircle, FaPlusSquare, FaRegPlusSquare, FaPlus, FaCircleNotch, FaSpinner, FaCross, FaTimes, FaEdit } from 'react-icons/fa';
import { connect } from 'react-redux';
import { logout, addImage, updateImage, addGlobalAPIError } from '../../store/actions';
import { Redirect, RouteComponentProps, withRouter } from 'react-router-dom';
import classNames from 'classnames';
import { sleep, ImageCache } from '../../utils';
import User from '../../api/user';
import Loading from '../../component/Loading';
import { image, userData, Keyword } from '../../store/reducers/application';
import './ImageView.css';
import ReactTooltip from 'react-tooltip';
import OutsideClickHandler from 'react-outside-click-handler';
import { throttle } from 'throttle-debounce';
import { AuthenticationError, APIResponse } from '../../api';
import { Accordion, Card, Button, Collapse, ListGroup, ButtonGroup } from 'react-bootstrap';
import Avatar from 'react-avatar';
import { WEBSITE_NAME } from '../../config';
const InlineEdit = require('react-edit-inline2').default;
interface P extends RouteComponentProps {
    images: image[]
    loggedIn: boolean
    userData: userData
    addImage: Function
    updateImage: Function
    addGlobalAPIError: Function
    logout: Function
}

interface S {
    redirect: boolean,
    // imgSrcLoading: boolean,
    preloadImage: HTMLImageElement | null,
    imgEleLoaded: boolean,
    detailsOpen: boolean,
    scanningOCR: boolean,
    url?: string,
    keywords: Keyword[]|null,
    activeKeywords: string[],
    loadingKeywords: boolean,
    addingSelectedKeywords: boolean,
    highlightedText: number[],
    highlighting: boolean,
    // Actual value isn't used, just used to force a rerender
    // of boxes when rendered image dimensions change due to
    // resizing.
    _imgWidth: number|null,
    _imgHeight: number|null
}

const KEYWORDS_MAX_DISPLAY: number = 5;
const KEYWORDS_MIN_SCORE: number = 3;
const FUZZY_SCORE_CUTOFF: number = .8;

export default connect(
    (state: any) => ({
        images: state.application.images,
        userData: state.application.userData,
        loggedIn: state.login.loggedIn,
    }),
    { logout, addImage, updateImage, addGlobalAPIError }
)(withRouter(class extends Component<P, S> {
    private cancelled: boolean = false;
    private _componentRef: React.RefObject<HTMLDivElement>
    private _imageRef: React.RefObject<HTMLImageElement>;
    private _resizeObserver?: ResizeObserver;
    constructor(props: P) {
        super(props);

        this.state = {
            redirect: false,
            // imgSrcLoading: false,
            // Not actually used for anything other than variable persistence while loading.
            preloadImage: null,
            imgEleLoaded: false,
            detailsOpen: false,
            scanningOCR: false,
            url: undefined,
            keywords: null,
            activeKeywords: [],
            loadingKeywords: false,
            addingSelectedKeywords: false,
            highlightedText: [],
            highlighting: false,
            _imgWidth: null,
            _imgHeight: null
        };

        this.loadImage = this.loadImage.bind(this);

        this._componentRef = React.createRef();
        this._imageRef = React.createRef();
    }
    imageIdFromProps(props: P): number {
        return parseInt((props.match.params as any).id);
    }
    imageUIDFromProps(props: P): string {
        return (props.match.params as any).uid;
    }
    imageId(): number {
        return this.getImage()!.id;
        // return this.imageIdFromProps(this.props);
    }
    imageUID(): string {
        return this.imageUIDFromProps(this.props);
    }
    getImage(): image|undefined {
        return this.props.images.find((image: image) => image.uid === this.imageUID());
    }
    switchImage(uid: string) {
        this.props.history.push(`/image/${uid}`);
    }
    toggleKeyword(keyword: string) {
        const { activeKeywords } = this.state;
        if (activeKeywords.includes(keyword)) {
            activeKeywords.splice(activeKeywords.indexOf(keyword), 1);
        } else {
            activeKeywords.push(keyword)
        }
        this.setState({ activeKeywords });
    }
    updateTitle() {
        const image = this.getImage();
        if (image) document.title = image.title || WEBSITE_NAME;
    }
    async preloadImage(image: image): Promise<void> {
        // This method's purpose is to preload and cache the image data,
        // but it's also the most convenient place to update the page title
        // for the view.
        
        const cacheRes = ImageCache.get(image.url, HTMLImageElement)
        if (cacheRes !== null && cacheRes instanceof HTMLImageElement) {
            this.setState({ preloadImage: cacheRes });
        } else {
            const img = new Image();
            img.src = image.url;
            img.onload = () => this.setState({ preloadImage: img });
            ImageCache.cache(image.url, img);
        }
        /*
        const image_data: Blob = (await User.loadImageAsBlob(image.url)).data;
        const url = URL.createObjectURL(image_data);
        this.setState({ url });
        */
    }
    async loadImage() {
        // this.setState({ imgSrcLoading : true });
        this.setState({
            imgEleLoaded: false,
            scanningOCR: false,
            highlightedText: [],
            highlighting: false,
            loadingKeywords: false,
            keywords: null,
            activeKeywords: []
        });
        if (this.getImage() === undefined) {
            const { message, error, image } = await User.getImage(this.imageUID());
            if (!this.cancelled) {
                if (error) {
                    console.log(message);
                    this.setState({ redirect : true });
                }
                else {
                    this.props.addImage(image);
                    this.preloadImage(image);
                }
            }
        } else {
            // Don't await image preloading, since it's not actually
            // part of loading the image itself, it's just a preparation
            // made alongside the loading. 
            this.preloadImage(this.getImage()!);
        }
    }
    async extractKeywords() {
        this.setState({ loadingKeywords: true });
        const response = await User.extractKeywords(this.imageId(), FUZZY_SCORE_CUTOFF);
        const { message, error, keywords } = response;
        if (error) {
            console.error(message);
            this.props.addGlobalAPIError(response);
        } else {
            const currentTags = this.getImage()!.tags!;
            // Only show keywords extracted that aren't already tags to avoid errors from trying to upload
            // duplicate tags (and avoid redundancy).
            const keywordsFiltered = keywords.filter((k) => !currentTags.includes(k.name))
                                             .filter((k) => k.score >= KEYWORDS_MIN_SCORE);
            this.setState({
                keywords: keywords.length === 0 ? null : keywordsFiltered,
                activeKeywords: []
            });
        }
        /*
        await sleep(2500);
        // Make sure keywords aren't already tags.
        this.setState({
            keywords: [
                {name: "Foo", score: 15},
                {name: "Bar", score: 5},
                {name: "Baz", score: 12},
                {name: "Spam", score: 2}
            ]
        });
        */
        this.setState({ loadingKeywords: false });
    }
    async clearOCR() {
        this.setState({ scanningOCR : false, highlightedText: [], highlighting: false, loadingKeywords: false, keywords: null, activeKeywords: [] });
        const image = this.getImage()!;
        await User.clearOCR(image.id);
    }
    async scanOCR(rescan: boolean=false) {
        this.setState({ scanningOCR : true, highlightedText: [], highlighting: false, loadingKeywords: false, keywords: null, activeKeywords: [] });
        const image = this.getImage()!;
        try {
            const response = await User.scanOCR(image.id, rescan);
            const { message, error, OCRText, OCRBoxes } = response;
            if (error) {
                // Title could not be set
                console.error(message);
                this.props.addGlobalAPIError(response);
            } else {
                /*
                this.props.updateImage({
                    ...image,
                    ocr_text: OCRText,
                    ocr_boxes: OCRBoxes
                });
                */
            }
            this.setState({ scanningOCR : false });
        }
        catch { this.props.logout(); }
    }
    async addSelectedTags() {
        this.setState({ addingSelectedKeywords: true });
        const { keywords, activeKeywords } = this.state;
        const result = await User.addTags(this.imageId(), activeKeywords);
        if (result.error) {
            console.error(result.message);
            this.props.addGlobalAPIError(result);
        } else {
            // this.props.updateImage({
            //     ...this.getImage(),
            //     tags: this.getImage()!.tags.concat(activeKeywords)
            // });
        }
        /*
        for (let i=0; i<activeKeywords.length; i++) {
            const keyword = activeKeywords[i];
            const result = await User.addTag(this.imageId(), keyword);
            if (result.error) {
                // Tag could not be added
                console.error(result.message);
                this.props.addGlobalAPIError(result);
            } else {
                // this.props.updateImage({
                //     ...this.props.image,
                //     tags: this.props.image.tags.concat(this.state.input)
                // })
                // this.props.updateTag(this.props.image.id, this.state.input, UpdateTagType.ADD);
            }
        }
        */
        this.setState({
            keywords: keywords!.filter((keyword) => !activeKeywords.includes(keyword.name)),
            activeKeywords: [],
            addingSelectedKeywords: false
        });
    }
    componentDidMount() {
        this.loadImage().then(() => this.updateTitle());

        this._resizeObserver = new ResizeObserver((entries) => {
            if (this._imageRef.current) {
                console.log("resize");
                this.setState({ _imgWidth: this._imageRef.current.width, _imgHeight: this._imageRef.current.height });
            }
        });
        if (this._componentRef.current) {
            this._resizeObserver.observe(this._componentRef.current);
        }
    }
    async componentDidUpdate(prevProps: P) {
        if (this.imageUIDFromProps(prevProps) !== this.imageUID()) {
            await this.loadImage();
        }
        if ((this.props.userData !== null && prevProps.userData === null) || (this.props.userData === null && prevProps.userData !== null)) {
            // Login state changed
            if (this.getImage() === undefined) await this.loadImage();
        }
        this.updateTitle();
    }
    componentWillUnmount() {
        this.cancelled = true;
        
        this._resizeObserver!.disconnect();
        this._resizeObserver = undefined;
        // this.state.url && URL.revokeObjectURL(this.state.url);
    }
    render() {
        // let loading = this.props.images === null;
        // let image: image|undefined;
        const redirect = <Redirect push to="/"/>;
        // if (!User.loggedIn) return redirect;
        // if (!loading) {
        //     image = this.props.images.filter((image: image) => image.id === this.imageId())[0];
        //     if (image === undefined) return redirect;
        // }
        if (this.state.redirect) return redirect;
        let image = this.getImage();
        const isAuthor = image && this.props.userData && image.author.username === this.props.userData.username;
        const showDetails = image && (image.private === 0 || isAuthor);
        return (
            <div className="ImageView" ref={this._componentRef}>
                {
                    (image === undefined || !this.state.preloadImage) ? (
                        <Loading loading={true}/>
                    ) : (() => {
                        image = image!;
                        return (
                            <>
                            <div className="image-container-top">
                                <div className="image-container py-3">
                                    {(() => {
                                        const nextImage: string|null = image.next;
                                        return (
                                            <div className="next-image image-arrow" style={{display: isAuthor ? undefined : "none"}}>
                                                <FaCaretLeft className={nextImage === null ? "disabled" : ""}
                                                             onClick={() => nextImage && this.switchImage(nextImage)}/>
                                            </div>
                                        );
                                    })()}
                                    {/* <div className="image-view-img-container mx-auto"> */}
                                    <div className="mx-auto d-flex justify-content-center" style={{maxHeight: "100%"}}>
                                        <Loading loading={!this.state.imgEleLoaded}/>
                                        <a href={image.url} target="_blank" className="mx-auto d-flex justify-content-center">
                                            <span style={{position: "relative"}}>
                                                <img className="image-view-img"
                                                src={image.url}
                                                ref={this._imageRef}
                                                style={{display: this.state.imgEleLoaded ? undefined : "none"}}
                                                onLoad={() => this.setState({ imgEleLoaded : true })}
                                                />
                                                {
                                                this._imageRef.current && this.state.highlightedText.map((i) => {
                                                    // When the router props change, the component renders once with
                                                    // a new image before componentDidUpdate and loadImage are called
                                                    // and set highlightedText empty.
                                                    if (!image!.ocr_boxes) return;
                                                    const img = this._imageRef.current;
                                                    const seg = i + 4;
                                                    const widthRatio = (img!.width / image!.width);
                                                    const heightRatio = (img!.height / image!.height);
                                                    const text = image!.ocr_boxes.text[seg];
                                                    const conf = image!.ocr_boxes.conf[seg];
                                                    const left = image!.ocr_boxes.left[seg] * widthRatio;
                                                    const top = image!.ocr_boxes.top[seg] * heightRatio;
                                                    const width = image!.ocr_boxes.width[seg] * widthRatio;
                                                    const height = image!.ocr_boxes.height[seg] * heightRatio;
                                                    const key = text + "-" + seg;
                                                    return (
                                                        <React.Fragment key={key}>
                                                        <div style={{
                                                                position: "absolute",
                                                                outline: "2px solid var(--danger)",
                                                                top: top + "px",
                                                                left: left + "px",
                                                                width: width + "px",
                                                                height: height + "px"
                                                            }}
                                                            className="ocr-highlighted-text-segment"
                                                            data-tip
                                                            data-for={key}>
                                                        </div>
                                                        <ReactTooltip id={key} place="top" effect="solid">
                                                            Confidence: {Math.round(parseInt(conf))}%
                                                        </ReactTooltip>
                                                        </React.Fragment>
                                                    );
                                                })
                                            }
                                            </span>
                                        </a>
                                    </div>
                                    {(() => {
                                        const prevImage: string|null = image.prev;
                                        return (
                                            <div className="previous-image image-arrow" style={{display: isAuthor ? undefined : "none"}}>
                                                <FaCaretRight className={prevImage === null ? "disabled" : ""}
                                                              onClick={() => prevImage && this.switchImage(prevImage)}/>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                            {showDetails && (<div className="image-info-container bg-light" style={{"padding": "1.75rem 0"}}>
                                <div className="image-info" style={{fontSize: "18px"}}>
                                    <div className="d-flex align-items-center mb-3">
                                        <Avatar name={image.author.username} src={image.author.profile_picture || undefined} className="mr-2" size="36" textSizeRatio={2} round style={{userSelect: "none"}}/>
                                        <span style={{fontSize: "1em", fontWeight: 600}}>{image.author.username}</span>
                                    </div>
                                    
                                    {/* <div className="mb-2" style={{fontSize: "1em", fontWeight: 600}}>{image.title}</div> */}
                                    {showDetails && (<div className="d-flex align-items-center mb-2">
                                        {
                                            isAuthor ? (
                                                <InlineEdit className=""
                                                    activeClassName="cursor-initial"
                                                    style={{
                                                        fontSize: "1em",
                                                        fontWeight: 600,
                                                        cursor: "pointer"
                                                    }}
                                                    text={image.title}
                                                    paramName="message"
                                                    change={async (obj: {message: string}) => {
                                                        const { message } = obj;
                                                        const id = image!.id;
                                                        console.log("Set title to", message);
                                                        try {
                                                            const result = await User.setTitle(id, message);
                                                            if (result.error) {
                                                                // Title could not be set
                                                                console.error(result.message);
                                                                this.props.addGlobalAPIError(result);
                                                            } else {
                                                                this.props.updateImage({
                                                                    ...image,
                                                                    title: message
                                                                });
                                                            }
                                                        }
                                                        catch { this.props.logout(); }
                                                    }}
                                                />
                                            ) : (
                                                <span style={{
                                                    fontSize: "1em",
                                                    fontWeight: 600
                                                }}>{image.title}</span>
                                            )
                                        }
                                    </div>
                                    )}
                                    <div style={{fontSize: ".85em"}}>
                                        <div className="mb-2">
                                            {
                                                new Date(image.timestamp).toLocaleDateString("us-EN", {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })
                                            }
                                        </div>
                                        <div className="py-1 mb-2">
                                            <a href="javascript:void(0);" onClick={() => this.setState({ detailsOpen: !this.state.detailsOpen})}>Details</a>
                                            <Collapse in={this.state.detailsOpen}>
                                                <div id="details-collapse" className="p-2">
                                                    <div className="my-2 text-muted"><b>Dimensions:</b> {image.width} x {image.height} px</div>
                                                    <div className="mb-2 text-muted"><b>File type:</b> {image.filename.split(".").pop()}</div>
                                                    <div className="text-muted"><b>Bit depth:</b> {image.bit_depth}</div>
                                                </div>
                                            </Collapse>
                                        </div>
                                        <div className="mt-1">
                                            {
                                                image.ocr_text !== null ? (
                                                    <Card className="d-none d-md-flex">
                                                        {/* Note: OCR component is hidden on mobile devices due to the difficulty of rendering
                                                            such a bulky module into a small horizontal space fluidly. Could be updated in the
                                                            future so that the rendering is completely different on mobile devices.  */}
                                                        <Card.Header as="h6"
                                                                     className="d-flex align-items-center justify-content-between p-2 hidden">
                                                            <span className="ml-2">OCR</span>
                                                            <div>
                                                                <ButtonGroup style={{display: isAuthor ? undefined : "none"}}>
                                                                <Button className=""
                                                                        variant={this.state.scanningOCR ? "outline-primary" : "primary"}
                                                                        disabled={this.state.scanningOCR}
                                                                        size="sm"
                                                                        onClick={() => !this.state.scanningOCR && this.scanOCR(true)}>
                                                                    {this.state.scanningOCR ? "Loading" : "Rescan"}
                                                                </Button>
                                                                <Button className=""
                                                                        variant="outline-secondary"
                                                                        size="sm"
                                                                        onClick={() => this.clearOCR()}>
                                                                    Clear
                                                                </Button>
                                                                </ButtonGroup>
                                                                <Button className="ml-2"
                                                                        variant={this.state.highlighting ? "outline-danger" : "success"}
                                                                        size="sm"
                                                                        onClick={() => this.setState({ highlighting: !this.state.highlighting })}>
                                                                    {this.state.highlighting ? "Stop" : "Highlight"}
                                                                </Button>
                                                            </div>
                                                        </Card.Header>
                                                        <Card.Body className="p-3">
                                                            {
                                                                image.ocr_text === "" ? (
                                                                    <span>No text found.</span>
                                                                ) : (
                                                                    <pre className="mb-0 ocr-text-container" data-highlighting={this.state.highlighting}>
                                                                        {/* Ignore first 4 elements (empty whitespace) */}
                                                                        {image.ocr_boxes.text.slice(4).map((text, i) => (
                                                                            text === "" ? <br key={i}/> : (
                                                                            <React.Fragment key={i}>
                                                                            <span className="ocr-highlightable-text-component"
                                                                                  style={this.state.highlightedText.includes(i) ? {
                                                                                      color: "white",
                                                                                      backgroundColor: "var(--danger)",
                                                                                      outline: "3px solid var(--danger)"
                                                                                  } : undefined}
                                                                                  onClick={() => {
                                                                                      if (!this.state.highlighting) return;
                                                                                      let { highlightedText } = this.state;
                                                                                      if (highlightedText.includes(i)) highlightedText = highlightedText.filter((t) => t !== i);
                                                                                      else highlightedText.push(i);
                                                                                      this.setState({ highlightedText });
                                                                                  }}>
                                                                                {text}
                                                                            </span><span> </span>
                                                                            </React.Fragment>
                                                                            )
                                                                        ))}
                                                                    </pre>
                                                                )
                                                            }
                                                        </Card.Body>
                                                        {
                                                            isAuthor && image.ocr_text !== "" && (
                                                                <Card.Footer>
                                                                    {
                                                                        this.state.keywords !== null ? (
                                                                            this.state.keywords.length === 0 ? (
                                                                                <span>No new keywords found.</span>
                                                                            ) : (
                                                                                <div className="d-flex align-items-center justify-content-between">
                                                                                    <ButtonGroup className="flex-wrap mr-2">
                                                                                        {
                                                                                            this.state.keywords.sort((a,b) => b.score - a.score)
                                                                                                               .slice(0, KEYWORDS_MAX_DISPLAY)
                                                                                                               .map((keyword) => {
                                                                                                const variant = keyword.fuzzed ? "success" : "primary";
                                                                                                return (
                                                                                                    <Button key={keyword.name}
                                                                                                        variant={(this.state.activeKeywords.includes(keyword.name) ? variant : "outline-" + variant) as any}
                                                                                                        style={{whiteSpace: "nowrap"}}
                                                                                                        onClick={() => this.toggleKeyword(keyword.name)}>
                                                                                                        {keyword.name}
                                                                                                    </Button>
                                                                                                );
                                                                                            })
                                                                                        }
                                                                                    </ButtonGroup>
                                                                                    <div className="d-flex align-items-center text-nowrap flex-wrap justify-content-center">
                                                                                        <Button variant="primary" disabled={this.state.addingSelectedKeywords} size="sm" onClick={() => this.addSelectedTags()}>Add</Button>
                                                                                        <Button className="m-1" variant="outline-secondary" size="sm" onClick={() => this.setState({ keywords: null, activeKeywords: [], addingSelectedKeywords: false })}>
                                                                                            Clear all
                                                                                        </Button>
                                                                                    </div>
                                                                                </div>
                                                                            )
                                                                        ) : (
                                                                            this.state.loadingKeywords ? (
                                                                                <span className="text-muted loading">Loading keywords</span>
                                                                            ) : (
                                                                                <a href="javascript:void(0);" onClick={() => this.extractKeywords()}>Run keyword extraction</a>
                                                                            )
                                                                        )
                                                                    }
                                                                </Card.Footer>
                                                            )
                                                        }
                                                        {/* <Card.Footer className="bg-light">
                                                            
                                                        </Card.Footer> */}
                                                    </Card>
                                                ) : (this.state.scanningOCR ? (
                                                    <div className="text-muted loading">Scanning</div>
                                                ) : (
                                                    isAuthor && <a href="javascript:void(0);" onClick={() => this.scanOCR()}>Scan OCR</a>
                                                ))
                                            }
                                        </div>
                                        {isAuthor && <div className="mt-3"><TagContainer image={image}/></div>}
                                    </div>
                                </div>
                            </div>
                            )}
                            </>
                        );
                    })()
                }
            </div>
        );
    }
}));

enum State {
    INACTIVE,
    INPUT,
    LOADING
};

interface TcP {
    logout: Function,
    updateImage: Function,
    addGlobalAPIError: Function,
    image: image
};

interface TcS {
    active: State,
    input: string|null
};

const TagContainer = connect(
    (state: any) => ({
        images: state.application.images,
    }),
    { logout, updateImage, addGlobalAPIError }
)(class extends Component<TcP, TcS> {
    constructor(props: TcP) {
        super(props);

        this.state = {
            active: State.INACTIVE,
            input: ""
        };
    }
    setActive(active: State) {
        this.setState({ active });
    }
    render() {
        return (
            <div className="tag-container">
                {this.props.image.tags!.map((tag,) => <Tag id={this.props.image.id} key={tag} name={tag} image={this.props.image}/>)}
                <OutsideClickHandler onOutsideClick={() => {
                    this.state.active === State.INPUT && this.setActive(State.INACTIVE);
                }}>
                <Tag closeButton={false} className="close-tag border border-primary text-primary bg-white" name={
                    this.state.active === State.INACTIVE ? (
                        <FaPlus style={{fontSize: "1rem"}}/>
                    ) : (this.state.active === State.INPUT ? (
                        <input type="text" autoFocus onKeyDown={async (e: React.KeyboardEvent) => {
                            if (e.keyCode === 27) {
                                this.state.active === State.INPUT && this.setActive(State.INACTIVE);
                            }
                            else if (e.keyCode === 13 && this.state.input !== null) {
                                console.log("Create tag", this.state.input);
                                this.setActive(State.LOADING);
                                try {
                                    const result = await User.addTag(this.props.image.id, this.state.input);
                                    if (result.error) {
                                        // Tag could not be added
                                        console.error(result.message);
                                        this.props.addGlobalAPIError(result);
                                    } else {
                                        this.props.updateImage({
                                            ...this.props.image,
                                            tags: this.props.image.tags!.concat(this.state.input)
                                        })
                                        // this.props.updateTag(this.props.image.id, this.state.input, UpdateTagType.ADD);
                                    }
                                } catch { this.props.logout(); }
                                this.setActive(State.INACTIVE);
                            }
                        }} onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            this.setState({ input : e.target.value });
                        }} className="no-style"/>
                    ) : (
                        <FaSpinner className="spin" style={{fontSize: "1rem"}}/>
                    ))
                } tagProps={{
                    onClick: () => {
                        this.state.active === State.INACTIVE && this.setActive(State.INPUT);
                    }
                }}/>
                </OutsideClickHandler>
            </div>
        );
    }
});

interface I {
    [key: string]: any
}

interface TP {
    id?: number,
    name: string|ReactElement,
    image?: image, // required to use updateImage, made optional because the tag adding widget doesn't need access
    className?: string,
    tagProps?: I,
    closeButton: boolean
    logout: Function,
    updateImage: Function,
    addGlobalAPIError: Function
};

interface TS {
    loading: boolean
};

const Tag = connect(
    undefined,
    { logout, updateImage, addGlobalAPIError }
)(class extends Component<TP, TS> {
    static defaultProps = {
        closeButton: true
    };
    constructor(props: TP) {
        super(props);

        this.state = {
            loading: false
        };
    }
    render() {
        return (
            <div className={classNames("tag d-flex justify-content-center align-items-center bg-primary text-white", this.props.className)} {...this.props.tagProps}>
                {
                    this.state.loading ? (
                        <FaSpinner className="spin" style={{fontSize: "1rem"}}/>
                    ) : (
                        <>
                        {this.props.name}
                        {this.props.closeButton && <div className="tag-close-button-container ml-2"><FaTimes className="" onClick={async () => {
                            this.setState({ loading : true });
                            try {
                                const result = await User.removeTag(this.props.id!, this.props.name as string);
                                if (result.error) {
                                    // Tag could not be added
                                    console.error(result.message);
                                    this.props.addGlobalAPIError(result);
                                } else {
                                    this.props.updateImage({
                                        ...this.props.image,
                                        // In this situation, it is guarenteed that `image` is defined
                                        tags: this.props.image!.tags!.filter((tag) => tag !== this.props.name)
                                    });
                                }
                            } catch {
                                this.props.logout();
                                // Don't need to set loading to false if successfully removed because it will already be unmounted.
                                this.setState({ loading : false });
                            }
                        }}/></div>}
                        </>
                    )
                }
            </div>
        );
    }
});