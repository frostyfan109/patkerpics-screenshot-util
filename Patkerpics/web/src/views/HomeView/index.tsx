import React, { Component } from 'react';
import { connect } from 'react-redux';
import Loading from '../../component/Loading';
import ImageContainer from '../../component/ImageContainer';
import { getApplicationLoading } from '../../store/selectors';
import { applicationInterface } from '../../store/reducers/application';
import { Jumbotron } from 'react-bootstrap';
import { addImages, logout, fetchedAllImages } from '../../store/actions';
import { WEBSITE_NAME } from '../../config';
import { image } from '../../store/reducers/application';
import User from '../../api/user';
import { AuthenticationError } from '../../api';

interface Props {
    loggedIn: boolean
    fetchedAllImages: boolean
    applicationLoading: boolean
    images: image[]
    addImages: Function
    setFetchedAllImages: Function
    logout: Function
};

class HomeView extends Component<Props, {}> {
    private cancelled: boolean = false;
    constructor(props: Props) {
        super(props);

        this.fetchImages = this.fetchImages.bind(this);
    }
    fetchImages() {
        if (!this.props.fetchedAllImages) {
            User.getImages().then((images: image[]) => {
                if (!this.cancelled) {
                    this.props.addImages(images);
                    this.props.setFetchedAllImages();
                }
            }).catch((error: AuthenticationError) => {
                this.props.logout();
            });
        }
    }
    componentWillUnmount() {
        this.cancelled = true;
    }
    componentDidMount() {
        this.props.loggedIn && this.fetchImages();
    }
    componentDidUpdate(prevProps: Props) {
        if (!prevProps.loggedIn && this.props.loggedIn) {
            this.fetchImages();
        }
    }
    render() {
        return (
            <div className="HomeView flex-grow-1">
                {
                    this.props.loggedIn ? (
                        this.props.applicationLoading ? (
                            <Loading loading={true}/>
                        ) : (
                            <ImageContainer className="h-100" images={this.props.images}/>
                        )
                    ) : 
                    (
                        <>
                        <div className="p-4">
                            <Jumbotron className="m-0">
                                <h2 className="text-center">Welcome to {WEBSITE_NAME}</h2>
                            </Jumbotron>
                        </div>
                        </>
                    )
                }
            </div>
        );
    }
}
export default connect(
    (state: any) => ({
        loggedIn: state.login.loggedIn,
        applicationLoading: getApplicationLoading(state),
        images: state.application.images,
        fetchedAllImages: state.application.fetchedAllImages
    }),
    { addImages, logout, setFetchedAllImages: fetchedAllImages }
)(HomeView);