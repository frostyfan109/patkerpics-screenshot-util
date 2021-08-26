import React, { Component } from 'react';
import { Route } from 'react-router-dom';
import * as Views from '../';

export default class Routes extends Component {
    render() {
        return (
            <>
                <Route exact path="/" component={Views.HomeView}/>
                <Route exact path="/image/:id" component={Views.ImageView}/>
                {/* <Route exact path="/raw_image/:id" component={Views.RawImageView}/> */}
            </>
        );
    }
}