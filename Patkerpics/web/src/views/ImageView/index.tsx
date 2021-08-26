import React, { Component, ReactElement, useState } from 'react';
import { FaCaretLeft, FaCaretRight, FaUserCircle, FaPlusSquare, FaRegPlusSquare, FaPlus, FaCircleNotch, FaSpinner, FaCross, FaTimes, FaEdit } from 'react-icons/fa';
import { connect } from 'react-redux';
import { logout, addImage } from '../../store/actions';
import { Redirect, RouteComponentProps, withRouter } from 'react-router-dom';
import classNames from 'classnames';
import User from '../../api/user';
import Loading from '../../component/Loading';
import { image } from '../../store/reducers/application';
import './ImageView.css';
import OutsideClickHandler from 'react-outside-click-handler';
import { AuthenticationError } from '../../api';
const InlineEdit = require('react-edit-inline2').default;
interface P extends RouteComponentProps {
    images: image[],
    loggedIn: boolean,
    addImage: Function,
    logout: Function
}

interface S {
    redirect: boolean
}

export default connect(
    (state: any) => ({
        images: state.application.images,
        loggedIn: state.login.loggedIn
    }),
    { logout, addImage }
)(withRouter(class extends Component<P, S> {
    private cancelled: boolean = false;
    constructor(props: P) {
        super(props);

        this.state = {
            redirect: false
        };

        this.loadImage = this.loadImage.bind(this);
    }
    imageIdFromProps(props: P): number {
        return parseInt((props.match.params as any).id);
    }
    imageId(): number {
        return this.imageIdFromProps(this.props);
    }
    getImage(): image|undefined {
        return this.props.images.find((image: image) => image.id === this.imageId());
    }
    switchImage(id: number) {
        this.props.history.push(`/image/${id}`);
    }
    loadImage() {
        if (this.getImage() === undefined) {
            User.getImage(this.imageId()).then((image: image|null) => {
                if (!this.cancelled) {
                    if (image === null) this.setState({ redirect : true });
                    else this.props.addImage(image);
                }
            }).catch((error: AuthenticationError) => {
                console.log(error);
                this.props.logout();
            });
        }
    }
    componentDidMount() {
        this.loadImage();
    }
    componentDidUpdate(prevProps: P) {
        if (this.imageIdFromProps(prevProps) !== this.imageId()) this.loadImage();
    }
    componentWillUnmount() {
        this.cancelled = true;
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
        if (this.state.redirect || !this.props.loggedIn) return redirect;
        let image = this.getImage();
        return (
            <div className="ImageView">
                {
                    image === undefined ? (
                        <Loading loading={true}/>
                    ) : (() => {
                        image = image!;
                        return (
                            <>
                            <div className="image-container-top">
                                <div className="image-container py-3">
                                    {(() => {
                                        const nextImage: number|null = image.next;
                                        return (
                                            <div className="next-image image-arrow">
                                                <FaCaretLeft className={nextImage === null ? "disabled" : ""}
                                                             onClick={() => nextImage && this.switchImage(nextImage)}/>
                                            </div>
                                        );
                                    })()}
                                    {/* <div className="image-view-img-container mx-auto"> */}
                                        <img className="image-view-img mx-auto" src={image.url} style={{
                                            cursor: "pointer"
                                        }} onClick={() => {
                                            // this.props.history.push(`/raw_image/${image!.id}`);
                                            window.location.href = image!.url;
                                        }}/>
                                    {/* </div> */}
                                    {(() => {
                                        const prevImage: number|null = image.prev;
                                        return (
                                            <div className="previous-image image-arrow">
                                                <FaCaretRight className={prevImage === null ? "disabled" : ""}
                                                              onClick={() => prevImage && this.switchImage(prevImage)}/>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                            <div className="image-info-container bg-light" style={{"padding": "1.75rem 0"}}>
                                <div className="image-info" style={{fontSize: "18px"}}>
                                    <div className="d-flex align-items-center mb-3">
                                        <FaUserCircle style={{fontSize: "2em", marginRight: ".5rem"}}/>
                                        <span style={{fontSize: "1em", fontWeight: 600}}>{User.username}</span>
                                    </div>
                                    
                                    {/* <div className="mb-2" style={{fontSize: "1em", fontWeight: 600}}>{image.title}</div> */}
                                    <div className="d-flex align-items-center mb-2">
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
                                                            }
                                                        }
                                                        catch { this.props.logout(); }
                                                    }}
                                        />
                                    </div>
                                    <div className="mb-3" style={{fontSize: ".85em"}}>
                                        {
                                            new Date(image.timestamp).toLocaleDateString("us-EN", {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                            })
                                        }
                                    </div>
                                    <div style={{fontSize: ".85rem"}}><TagContainer image={image}/></div>
                                </div>
                            </div>
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
    image: image
};

interface TcS {
    active: State,
    input: string|null
};

const TagContainer = connect(
    undefined,
    { logout }
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
                {this.props.image.tags.map((tag,) => <Tag id={this.props.image.id} key={tag} name={tag}/>)}
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
    name: string|ReactElement
    className?: string,
    tagProps?: I,
    closeButton: boolean
    logout: Function
};

interface TS {
    loading: boolean
};

const Tag = connect(
    undefined,
    { logout }
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
                        {this.props.closeButton && <FaTimes className="ml-2" onClick={async () => {
                            this.setState({ loading : true });
                            try {
                                const result = await User.removeTag(this.props.id!, this.props.name as string);
                                if (result.error) {
                                    // Tag could not be added
                                    console.error(result.message);
                                }
                            } catch { this.props.logout(); }
                            this.setState({ loading : false });
                        }}/>}
                        </>
                    )
                }
            </div>
        );
    }
});