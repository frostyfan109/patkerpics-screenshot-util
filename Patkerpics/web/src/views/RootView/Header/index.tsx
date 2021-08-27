import React, { Component } from 'react';
import { connect } from 'react-redux';
import { Navbar, Nav, Form, Button, Modal, Alert, FormControl } from 'react-bootstrap';
import { LinkContainer } from 'react-router-bootstrap';
import { FaCameraRetro } from 'react-icons/fa';
import { login, logout, register } from '../../../store/actions';
import { loginInterface as loginStateInterface } from '../../../store/reducers/login';
import { WEBSITE_NAME } from '../../../config';
import Cookies from 'js-cookie';
import User from '../../../api/user';
import { APIResponse } from '../../../api';

interface HeaderProps {
    logout: Function,
    loggedIn: boolean
};

class Header extends Component<HeaderProps, {}> {
    private loginModal = React.createRef<LoginModalClass>();
    constructor(props: HeaderProps) {
        super(props);

        this.openLoginModal = this.openLoginModal.bind(this);
    }
    private openLoginModal(signup: boolean = false): void {
        this.loginModal.current && this.loginModal.current.show(signup);
    }
    render() {
        return (
            <>
            <LoginModal ref={this.loginModal}/>
            <Navbar bg="light" expand="md">
                <LinkContainer exact to="/">
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
                                <>
                                <FormControl placeholder="Search captures" className="mr-2"/>
                                <Button variant="secondary" onClick={(): void => {this.props.logout();}}>Logout</Button>
                                </>
                            )
                        }
                    </Form>
                </Navbar.Collapse>
            </Navbar>
            </>
        );
    }
}
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