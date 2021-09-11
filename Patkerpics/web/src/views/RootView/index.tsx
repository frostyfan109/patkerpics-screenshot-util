import React, { Component } from 'react';
import { connect } from 'react-redux';
import { BrowserRouter as Router } from 'react-router-dom';
import Cookies from 'js-cookie';
import { fetchApplicationState, pageLoad } from '../../store/actions';
import Header from './Header';
import Routes from './Routes';
import './RootView.css';
import User from '../../api/user';

interface RootViewProps {
    fetchApplicationState: Function,
    pageLoad: Function
    loggedIn: boolean
};

class RootView extends Component<RootViewProps, {}> {
    componentDidMount() {
        // this.props.pageLoad();
    }
    render() {
        return (
            <div className="App d-flex flex-column">
                <Router>
                    <Header/>
                    {/* <div className="view-container flex-grow-1 w-100"> */}
                    <Routes/>
                    {/* </div> */}
                </Router>
            </div>
        );
    }
}

export default connect(
    (state: any) => ({
        loggedIn: state.login.loggedIn
    }),
    { fetchApplicationState, pageLoad }
)(RootView);