import React, { Component } from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter, Redirect } from 'react-router-dom';
import { image } from '../../store/reducers/application';
import User from '../../api/user';
import Loading from '../../component/Loading';

interface P extends RouteComponentProps {
    images: image[]
}

export default connect(
    (state: any) => ({
        images: state.application.images
    })
)(withRouter(class extends Component<P> {
    imageId(): number {
        return parseInt((this.props.match.params as any).id);
    }
    render() {
        let loading = this.props.images === null;
        let image: image|undefined;
        const redirect = <Redirect push to="/"/>;
        if (!User.loggedIn) return redirect;
        if (!loading) {
            image = this.props.images.filter((image: image) => image.id === this.imageId())[0];
            if (image === undefined) return redirect;
        }
        return (
                loading ? (
                    <Loading loading={true}/>                    
                ) : (
                    <div>{image!.title}</div>
                )
        );
    }
}));