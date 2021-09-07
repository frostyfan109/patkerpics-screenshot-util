import React, { Component } from 'react';
import { connect } from 'react-redux';
import { withRouter, RouteComponentProps } from 'react-router-dom';
import { Navbar, Nav, Form, Button, Modal, Alert, FormControl, ProgressBar } from 'react-bootstrap';
import { Dropdown, DropdownToggle, DropdownMenu } from 'reactstrap';
import { LinkContainer } from 'react-router-bootstrap';
import { Typeahead, TypeaheadMenu, Menu, MenuItem } from 'react-bootstrap-typeahead';
import { FaCameraRetro, FaPlus, FaCamera, FaCircle, FaImages } from 'react-icons/fa';
import { IoIosAdd } from 'react-icons/io';
import DayPicker from 'react-day-picker';
import Loading from '../../../component/Loading';
import Avatar from 'react-avatar';
import Dropzone from 'react-dropzone';
import ReactCrop from 'react-image-crop';
import prettyBytes from 'pretty-bytes';
import classNames from 'classnames';
import { login, logout, register, updateUserData, addGlobalAPIError, setSearchQuery } from '../../../store/actions';
import { loginInterface as loginStateInterface } from '../../../store/reducers/login';
import { userData } from '../../../store/reducers/application';
import { SearchQualifiers } from '../../../store/reducers/page';
// import { getBytesUsed } from '../../../store/selectors';
import { WEBSITE_NAME } from '../../../config';
import Cookies from 'js-cookie';
import User from '../../../api/user';
import { APIResponse } from '../../../api';
import 'react-image-crop/dist/ReactCrop.css';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import 'react-day-picker/lib/style.css';

interface HeaderProps extends RouteComponentProps {
    logout: Function
    setSearchQuery: Function
    userData: userData
    loggedIn: boolean
    searchQuery: string|undefined,
    qualifier_pattern: string|undefined,
    search_qualifiers: SearchQualifiers,
};
interface DatePopup {
    callback: Function,
    min: number,
    max: number
}
interface HeaderState {
    autocomplete: {label: string, full: string}[],
    datePopup: DatePopup|null
};

const Header = connect(
    (state: any) => ({
        userData: state.application.userData,
        searchQuery: state.page.searchQuery,
        qualifier_pattern: state.page.applicationData?.search.qualifier_pattern,
        search_qualifiers: state.page.applicationData?.search.search_qualifiers
    }),
    { setSearchQuery }
)(withRouter(class extends Component<HeaderProps, HeaderState> {
    private loginModal = React.createRef<LoginModalClass>();
    private typeahead = React.createRef<Typeahead<any>>();
    constructor(props: HeaderProps) {
        super(props);

        this.state = {
            autocomplete: [],
            datePopup: null
        };

        this.openLoginModal = this.openLoginModal.bind(this);
    }
    private openLoginModal(signup: boolean = false): void {
        this.loginModal.current && this.loginModal.current.show(signup);
    }
    private updateSearch(value: string) {
        this.setState({ autocomplete: [], datePopup: null });
        if (!this.typeahead.current) return;
        // this.typeahead.current.state.selected = [];
        // this.typeahead.current.getInput().value = e;
        
        this.props.setSearchQuery(value);
        if (value === "" || typeof(value) === "undefined") {
            this.props.history.push("/");
        } else {
            // Bug with version of the history lib that react-router uses.
            // See: https://stackoverflow.com/questions/48523058/encoding-uri-using-link-of-react-router-dom-not-working
            this.props.history.push("/search/" + encodeURIComponent(encodeURIComponent(value)));
        }
    }
    private updateTypeahead() {
        if (this.typeahead.current) {
            this.setState({ autocomplete: [], datePopup: null });
            // console.log("set value");
            // const input = this.typeahead.current.getInput();
            // input.value = this.props.searchQuery || "";
            const value = this.typeahead.current.getInput().value;
            if (this.props.qualifier_pattern && this.props.userData) {
                const { qualifier_values, qualifier_value_frequency } = this.props.userData;
                const inputPosition = this.typeahead.current.getInput().selectionStart!;
                if (inputPosition !== value.length) {
                    // This is the behavior used in programs like Discord for searching.
                    // Completion is actually fully supported part-way through the input value,
                    // but the react-bootstrap-typeahead menu breaks and there is no workaround.
                    
                    // return;
                }
                const re = new RegExp(this.props.qualifier_pattern, "gi");
                let match: any;
                while (match = re.exec(value)) {
                    const { qualifier, value: qualifierValue } = match.groups as any;
                    if (inputPosition >= match.index && inputPosition <= match.index + match[0].length) {
                        const qualifierGroup = match[0];
                        const pos = inputPosition - match.index;
                        // Only suggest if editing the end of the qualifier or value
                        if (pos === qualifier.length) {
                            // Editing end of qualifier
                        } else if (pos === qualifierGroup.length) {
                            // Editing end of value
                            const qualifierType = this.props.search_qualifiers[qualifier];
                            // Make sure the qualifier is valid
                            if (qualifierType !== undefined) {
                                const validQualifierValues = qualifier_values[qualifier];
                                const startSearch = value.slice(0, match.index);
                                const endSearch = value.slice(match.index + qualifierGroup.length, value.length);
                                const startOfQualifierValue = qualifierGroup.indexOf(qualifier) + qualifier.length + 1;
                                if (qualifierType === "string") {
                                    if (validQualifierValues !== null) {
                                        const possibleValues = validQualifierValues.filter((val) => val.startsWith(qualifierValue));
                                        const possibleValuesFormatted = possibleValues.map((pVal) => {
                                            const newQualifierGroup = qualifier + ":" + pVal;
                                            const full = startSearch + qualifierGroup.slice(0, startOfQualifierValue) + pVal + endSearch;
                                            return {
                                                label: newQualifierGroup,
                                                full
                                            };
                                        });
                                        this.setState({ autocomplete : possibleValuesFormatted });
                                    }
                                }
                                if (qualifierType === "date") {
                                    if (qualifierValue === "") {
                                        this.setState({ datePopup: {
                                            callback: () => {
                                                const dateString = "foobar";
                                                const full = startSearch + qualifierGroup.slice(0, startOfQualifierValue) + dateString + endSearch;
                                                this.props.setSearchQuery(full);
                                                this.setState({ datePopup : null });
                                            },
                                            min: 0,
                                            max: 1e15
                                        }});
                                    }
                                }
                            } else {
                                // Highlight the qualifier as invalid
                                /* TODO */
                            }
                        }
                    };
                }
            }
        }
    }
    componentDidMount() {
        this.updateTypeahead();
    }
    componentDidUpdate(prevProps: HeaderProps) {
        if (this.props.searchQuery !== prevProps.searchQuery) {
            this.setState({}, () => this.updateTypeahead());
        }
    }
    render() {
        return (
            <>
            <LoginModal ref={this.loginModal}/>
            <Navbar bg="light" expand="md">
                <LinkContainer exact to="/" onClick={() => this.props.setSearchQuery(undefined)}>
                    <Nav.Link className="p-0" >
                        <Navbar.Brand className="d-flex align-items-center">
                            <FaCameraRetro className="mr-2" style={{ fontSize : "1.5rem"}}/>
                            {WEBSITE_NAME}
                        </Navbar.Brand>
                    </Nav.Link>
                </LinkContainer>
                <Navbar.Toggle/>
                <Navbar.Collapse>
                    <Nav className="mr-auto">
                        
                    </Nav>
                    <Form inline>
                        {
                            !this.props.loggedIn ? (
                                <>
                                <Button variant="primary" onClick={(): void => {this.openLoginModal(false);}}>Login</Button>
                                <Button variant="outline-primary" className="ml-2" onClick={(): void => {this.openLoginModal(true);}}>Sign up</Button>
                                </>
                            ) : (
                                this.props.userData && (
                                    <>
                                    <div style={{position: "relative"}} onBlur={() => this.setState({ autocomplete: [], datePopup: null })}>
                                        <Typeahead ref={this.typeahead}
                                                placeholder="Search captures"
                                                className={classNames("mr-2", this.state.autocomplete.length === 0 && "empty")}
                                                id="search-bar"
                                                labelKey={(opt) => opt.full}
                                                inputProps={{onSelect: () => this.updateTypeahead()}}
                                                highlightOnlyResult={false}
                                                filterBy={(option, props) => true}
                                                renderMenu={(results, menuProps) => (
                                                    <Menu {...menuProps}>
                                                        {results.map((result, index) => (
                                                            <MenuItem option={result} position={index}>
                                                                {result.label}
                                                            </MenuItem>
                                                        ))}
                                                    </Menu>
                                                )}
                                                selected={[{full: this.props.searchQuery || "", label: this.props.searchQuery || ""}]}
                                                options={this.state.autocomplete}
                                                onFocus={() => this.updateTypeahead()}
                                                onChange={(selected) => selected.length > 0 && this.updateSearch(selected[0].full)}
                                                onInputChange={(text, e) => this.updateSearch(text)}/>
                                        {this.state.datePopup !== null && (
                                            <DayPicker disabledDays={{
                                                before: new Date(this.state.datePopup.min * 1000),
                                                after: new Date(this.state.datePopup.max * 1000)
                                            }} className="search-date-picker shadow shadow-md"/>
                                        )}
                                    </div>
                                    {/*renderInput={(inputProps: any) => (
                                                   <Form.Control {...inputProps}
                                                                 ref={(input: any) => {
                                                                     inputProps.inputRef(input);
                                                                     inputProps.referenceElementRef(input);
                                                                 }}
                                                                 value={this.props.searchQuery}/>
                                                                )}*/}
                                    {/* <FormControl value={this.props.searchQuery || ""} placeholder="Search captures" className="mr-2" onChange={(e) => this.updateSearch(e)}/> */}
                                    <AvatarDropdown data={this.props.userData}/>
                                    {/* <Button variant="secondary" onClick={(): void => {this.props.logout();}}>Logout</Button> */}
                                    </>
                                )
                            )
                        }
                    </Form>
                </Navbar.Collapse>
            </Navbar>
            </>
        );
    }
}));
interface ADP {
    data: userData
    logout: Function,
    updateUserData: Function,
    addGlobalAPIError: Function
};
interface ADS {
    dropdownOpen: boolean,
    avatarModal: boolean,
    avatarUploadImage: string|null,
    avatarUploadImageData: any,
    avatarUploading: boolean,
    crop: any
}
const AvatarDropdown = connect(
    (state: any) => ({
    }),
    { logout, updateUserData, addGlobalAPIError }
)(class AvatarDropdown extends Component<ADP, ADS> {
    private _imgRef?: HTMLImageElement;
    constructor(props: ADP) {
        super(props);
        
        this.state = {
            dropdownOpen: false,
            avatarModal: false,
            avatarUploadImage: null,
            avatarUploadImageData: null,
            avatarUploading: false,
            crop: null
        };

        this.toggleDropdown = this.toggleDropdown.bind(this);
    }
    private toggleDropdown() {
        this.setState({ dropdownOpen : !this.state.dropdownOpen });
    }
    private async savePhoto() {
        const { crop } = this.state;
        const image = this.state.avatarUploadImage!;
        let imageData: Blob;
        if (crop !== null && crop.width > 0 && crop.height > 0) {
            const img = this._imgRef!;
            const scaleX = img.naturalWidth / img.width;
            const scaleY = img.naturalHeight / img.height;
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d")!;
            const pixelRatio = window.devicePixelRatio;

            canvas.width = crop.width * pixelRatio * scaleX;
            canvas.height = crop.height * pixelRatio * scaleY;

            ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            ctx.imageSmoothingQuality = 'high';

            ctx.drawImage(
                img,
                crop.x * scaleX,
                crop.y * scaleY,
                crop.width * scaleX,
                crop.height * scaleY,
                0,
                0,
                crop.width * scaleX,
                crop.height * scaleY
            );
            imageData = await new Promise((resolve) => {
                canvas.toBlob((blob) => resolve(blob!), "image/png");
            });
        } else {
            imageData = this.state.avatarUploadImageData;
        }
        const resp = await User.setProfilePicture(imageData);
        if (resp.error) {
            console.error(resp.error);
            this.props.addGlobalAPIError(resp);
        }
        this.setState({ avatarUploadImage: null, avatarUploadImageData: null, avatarModal: false, crop: null });

        try{
            const dataURI = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(reader.error);
                reader.onabort = () => reject(new Error("Profile picture FileReader aborted."));
                reader.readAsDataURL(imageData);
            });
            this.props.updateUserData({
                "profile_picture": dataURI
            });
        } catch (e) {
            console.error(e);
        }
    }
    private async uploadFile(_file: File[]) {
        this.setState({ avatarUploading : true });
        const file = _file[0];
        const data = await file.arrayBuffer();
        const blob = new Blob([data]);
        const url = URL.createObjectURL(blob);

        // const image = new Image();
        // image.src = url;
        // await new Promise((resolve) => {
        //     image.onload = resolve;
        //     image.onerror = resolve;
        // });
        // const width = image.width;
        // const height = image.height;
        this.setState({ avatarUploadImage: url, avatarUploadImageData: blob, avatarUploading : false });
    }
    private imageCropperLoaded(image: HTMLImageElement) {
        this._imgRef = image;
        const parent = image.parentElement!;
        let { width, height } = image.getBoundingClientRect();
        width = Math.abs(width);
        height = Math.abs(height);
        // ReactCrop is broken and overrides `crop` after calling onImageLoaded
        // for some reason so you can't set `crop` state inside of it.
        const cropWidth = width / 2;
        const cropHeight = width / 2;
        const cropX = (width / 2) - (cropWidth / 2) + ((parent.offsetWidth - image.width) / 2);
        const cropY = (height / 2) - (cropHeight / 2) + ((parent.offsetHeight - image.height) / 2);
        this.setState({}, () => {
            this.setState({ crop: {
                width: cropWidth,
                height: cropHeight,
                x: cropX,
                y: cropY,
                unit: "px",
                aspect: 1
            }});
        });
    }
    render() {
        return (
            <>
            <Dropdown isOpen={this.state.dropdownOpen}
                      toggle={this.toggleDropdown}
                      className="avatar-dropdown-container">
                <DropdownToggle id="avatarDropdown" tag="div" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <Avatar src={this.props.data.profile_picture || undefined} name={this.props.data.username} size="40" textSizeRatio={2} round style={{userSelect: "none"}}/>
                </DropdownToggle>
                <DropdownMenu className="py-2 px-1" right>
                    <div className="d-flex align-items-center py-2 px-2">
                        <div className="user-avatar-container mr-3" onClick={() => this.setState({ avatarModal : true })} style={{cursor: "pointer"}}>
                            <Avatar name={this.props.data.username}
                                    className="user-avatar"
                                    src={this.props.data.profile_picture || undefined}
                                    size="54"
                                    textSizeRatio={2}
                                    round
                                    style={{userSelect: "none"}}></Avatar>
                            <div className="add-icon">
                                <FaCamera/>
                                {/* <IoIosAdd/> */}
                                {/* CHANGE */}
                            </div>
                        </div>
                        <div>
                            <h6 className="m-0">{this.props.data.username}</h6>
                            <div>{this.props.data.email}</div>
                            {/* 1E10 Bytes = 10 GB */}
                            <ProgressBar className="mt-2" style={{height: "4px"}} min={0} max={1} now={this.props.data.bytes_used/1E10}/>
                            <div className="text-muted text-nowrap">
                                {prettyBytes(this.props.data.bytes_used).replace(" ", "")} of 10GB used
                            </div>
                        </div>
                    </div>
                    <div className="px-2 py-2">
                        <Button variant="primary" className="w-100" onClick={() => this.props.logout()}>Sign out</Button>
                    </div>
                </DropdownMenu>
            </Dropdown>
            <Modal className="change-avatar-modal"
                   show={this.state.avatarModal}
                   onHide={() => this.setState({ avatarModal : false })}
                   backdrop="static">
                <Modal.Header closeButton>
                    <Modal.Title>Select profile photo</Modal.Title>
                </Modal.Header>
                <Modal.Body style={{minHeight: 0, flex: 1}}>
                    {
                        this.state.avatarUploadImage !== null ? (
                            <ReactCrop src={this.state.avatarUploadImage}
                                       className="avatar-crop"
                                       crop={this.state.crop}
                                       circularCrop={true}
                                       onImageLoaded={(image) => this.imageCropperLoaded(image)}
                                       onChange={(crop) => this.setState({ crop })}/>
                        ) : (this.state.avatarUploading ? (
                            <Loading loading={true}/>
                        ) : (
                            <Dropzone accept="image/*" multiple={false} onDrop={(file) => this.uploadFile(file)}>
                                {({getRootProps, getInputProps}) => (
                                    <section className="h-100 w-100">
                                        <input {...getInputProps()}/>
                                        <div className="h-100 d-flex justify-content-center align-items-center" {...getRootProps()}>
                                            <div className="blank-state d-flex flex-column align-items-center text-muted">
                                                <span style={{display: "grid", placeItems: "center"}}>
                                                    {/* <FaCircle style={{fontSize: "48px", gridArea: "1 / 1"}} className="text-primary"/> */}
                                                    <FaImages style={{fontSize: "64px", gridArea: "1 / 1"}}/>
                                                </span>
                                                <h4 className="my-3">Drag a profile photo here</h4>
                                                <span className="caption">or</span>
                                                <Button className="mt-3" variant="outline-secondary" size="sm">Select a photo from your computer</Button>
                                            </div> 
                                        </div>
                                    </section>
                                )}
                            </Dropzone>
                        ))
                    }
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="primary" disabled={this.state.avatarUploadImage === null} onClick={() => this.savePhoto()} size="sm">Confirm</Button>
                    {this.state.avatarUploadImage !== null && (
                        <Button variant="outline-danger" size="sm" onClick={() => this.setState({ avatarUploadImage : null })}>Reselect</Button>
                    )}
                    <Button variant="outline-secondary" onClick={() => this.setState({ avatarModal : false })} size="sm">Cancel</Button>
                </Modal.Footer>
            </Modal>
            </>
        );
    }
})

interface LoginModalProps {
    login: Function,
    register: Function,
    loggedIn: boolean
};
interface LoginModalState {
    show: boolean,
    signup: boolean,
    validated: boolean,
    error: string|null
};
class LoginModalClass extends Component<LoginModalProps, LoginModalState> {
    private signupPassword = React.createRef<any>();
    private signupConfirmPassword = React.createRef<any>();
    constructor(props: LoginModalProps) {
        super(props);
     
        this.state = {
            show: false,
            signup: false,
            validated: false,
            error: null
        };

        this.show = this.show.bind(this);
        this.hide = this.hide.bind(this);
    }
    public show(signup: boolean): void {
        this.setState({
            show: true,
            signup,
            validated: false,
            error: null
        });
    }
    public hide(): void {
        this.setState({
            show: false,
            signup: false,
            validated: false,
            error: null
        });
    }
    private signup() {
        return (
            <Form noValidate validated={this.state.validated} onSubmit={(e: React.FormEvent): void => {
                e.preventDefault();
                this.setState({ validated : true });
                const form: HTMLFormElement = e.currentTarget as HTMLFormElement;
                if (form.checkValidity()) {
                    const username: string = form.username.value;
                    const email: string = form.email.value;
                    const password: string = form.password.value;
                    const thunk: any = this.props.register(username, email, password);
                    thunk.then((response: APIResponse) => {
                        if (!response.error) {
                            this.hide();
                        }
                        else {
                            this.setState({ error : response.message!, validated : false });
                        }
                    });
                }
            }}>
                <Form.Group>
                    <Form.Label>Username</Form.Label>
                    <Form.Control type="text" name="username" required placeholder="Enter a username"/>
                </Form.Group>
                <Form.Group>
                    <Form.Label>Email</Form.Label>
                    <Form.Control type="email" name="email" required placeholder="Enter an email address"/>
                </Form.Group>
                <Form.Group>
                    <Form.Label>Password</Form.Label>
                    <Form.Control type="password"
                                  name="password"
                                  ref={this.signupPassword}
                                  onChange={(): void => {this.forceUpdate();}}
                                  required
                                  placeholder="Enter a password"/>
                </Form.Group>
                {/* <Form.Group>
                    <Form.Label>Confirm Password</Form.Label>
                    {
                        console.log(
                            this.signupPassword.current &&
                            this.signupConfirmPassword.current &&
                            this.signupPassword.current.value === this.signupConfirmPassword.current.value
                          )
                    }
                    <Form.Control type="password"
                                  ref={this.signupConfirmPassword}
                                  onChange={(): void => {this.forceUpdate();}}
                                  placeholder="Confirm password"
                                  isInvalid={
                                      this.state.validated && (
                                        !this.signupPassword.current ||
                                        !this.signupConfirmPassword.current ||
                                        this.signupPassword.current.value !== this.signupConfirmPassword.current.value
                                      )
                                  }/>
                    <Form.Control.Feedback type="invalid">Passwords do not match</Form.Control.Feedback>
                </Form.Group> */}
                <Button type="submit" variant="primary" className="w-100 mt-1 mb-3">
                    Confirm
                </Button>
                <div className="d-flex justify-content-center align-items-center">
                    <small className="text-muted">Already have an account?&nbsp;</small>
                    <Nav.Link className="d-inline-flex p-0" onClick={(): void => {
                        this.show(false);
                    }}><small>Login</small></Nav.Link>
                </div>
            </Form>
        );
    }
    private login() {
        return (
            <Form noValidate validated={this.state.validated} onSubmit={(e: React.FormEvent): void => {
                e.preventDefault();
                this.setState({ validated : true });
                const form: HTMLFormElement = e.currentTarget as HTMLFormElement;
                if ((form).checkValidity()) {
                    const username: string = form.username.value;
                    const password: string = form.password.value;
                    const thunk: any = this.props.login(username, password);
                    thunk.then((response: APIResponse) => {
                        if (!response.error) {
                            this.hide();
                        }
                        else {
                            this.setState({ error : response.message!, validated : false });
                        }
                    });
                }
            }}>
                <Form.Group>
                    <Form.Label>Username</Form.Label>
                    <Form.Control type="text" name="username" required placeholder="Enter your username or email"/>
                </Form.Group>
                <Form.Group>
                    <Form.Label>Password</Form.Label>
                    <Form.Control type="password" name="password" required placeholder="Enter your password"/>
                </Form.Group>
                <Alert show={this.state.error !== null} variant="danger" className="text-center py-2">
                    {this.state.error}
                </Alert>
                <Button type="submit" variant="primary" className="w-100 mt-1 mb-3">
                    Confirm
                </Button>
                <div className="d-flex justify-content-center align-items-center">
                    <small className="text-muted">Need an account?&nbsp;</small>
                    <Nav.Link className="d-inline-flex p-0" onClick={(): void => {
                        this.show(true);
                    }}><small>Register</small></Nav.Link>
                </div>
            </Form>
        );
    }
    // componentDidUpdate(): void {
    //     if (this.state.show && !this.state.signup && this.props.loggedIn) {
    //         this.hide();
    //     }
    // }
    render() {
        return (
            <Modal size="lg" dialogClassName="login-dialog" show={this.state.show} centered onHide={(): void => {
                this.hide();
            }}>
                <Modal.Header closeButton>
                    <h5 className="m-0">{this.state.signup ? "Register" : "Login"}</h5>
                </Modal.Header>
                <Modal.Body>
                    {
                        this.state.signup ? this.signup() : this.login()
                    }
                </Modal.Body>
            </Modal>
        );
    }
}
const LoginModal = connect(
    (state: any) => ({
        loggedIn : state.login.loggedIn
    }),
    { login, register },
    undefined,
    { forwardRef : true }
)(LoginModalClass);

export default connect(
    (state: any) => ({
        loggedIn : state.login.loggedIn
    }),
    { logout }
)(Header);