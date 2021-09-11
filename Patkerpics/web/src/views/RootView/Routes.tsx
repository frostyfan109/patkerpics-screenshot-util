import React, { Component } from 'react';
import { Route, Redirect, Switch } from 'react-router-dom';
import * as Views from '../';

export default class Routes extends Component {
    render() {
        return (
            <Switch>
                <Route exact path="/" component={Views.HomeView}/>
                <Route exact path="/search/:search" component={Views.HomeView}/>
                <Route exact path="/image/:uid" component={Views.ImageView}/>
                <Redirect to="/"/>
                {/* <Route exact path="/raw_image/:id" component={Views.RawImageView}/> */}
            </Switch>
        );
    }
}