import React, { Component } from 'react';
import { connect } from 'react-redux';
import Loading from '../../component/Loading';
import ImageContainer from '../../component/ImageContainer';
import { getApplicationLoading } from '../../store/selectors';
import { applicationInterface } from '../../store/reducers/application';
import { Jumbotron } from 'react-bootstrap';
import { addImages, logout, fetchedAllImages, addGlobalAPIError, setSearchQuery } from '../../store/actions';
import { WEBSITE_NAME } from '../../config';
import { image } from '../../store/reducers/application';
import User from '../../api/user';
import { AuthenticationError } from '../../api';
import { RouteComponentProps } from 'react-router-dom';

let IS_FIRST_MOUNT = true;

interface Props extends RouteComponentProps {
    loggedIn: boolean
    fetchedAllImages: boolean
    applicationLoading: boolean
    images: image[]
    addImages: Function
    setFetchedAllImages: Function,
    addGlobalAPIError: Function
    logout: Function,
    setSearchQuery: Function
};

class HomeView extends Component<Props, {}> {
    private cancelled: boolean = false;
    constructor(props: Props) {
        super(props);

        this.fetchImages = this.fetchImages.bind(this);
    }
    async fetchImages() {
        if (!this.props.fetchedAllImages) {
            const response = await User.getImages();
            const { message, error, images } = response;
            if (!this.cancelled) {
                if (error) {
                    console.error(message);
                    this.props.addGlobalAPIError(response);
                } else {
                    this.props.addImages(images);
                    this.props.setFetchedAllImages();
                }
            }
        }
    }
    componentWillUnmount() {
        this.cancelled = true;
    }
    componentDidMount() {
        let { search } = this.props.match.params as any;
        // React-router doesn't seem to offer any way to hydrate redux state on page load,
        // so you're forced to do something like this instead.
        // this.props.setSearchQuery(search === "" || typeof search === "undefined" ? undefined : decodeURIComponent(search));
        // console.log("mount",Date.now());
        this.props.setSearchQuery(search === "" || typeof search === "undefined" ? undefined : decodeURIComponent(search));
        this.props.loggedIn && this.fetchImages();
        document.title = WEBSITE_NAME;
        IS_FIRST_MOUNT = false;
    }
    componentDidUpdate(prevProps: Props) {
        if (!prevProps.loggedIn && this.props.loggedIn) {
            this.fetchImages();
        }
        const search = (this.props.match.params as any).search;
        if (search !== (prevProps.match.params as any).search) {
            // Note: there is a bug with react-router that causes going back/forwards to automatically
            // decode the URL, which converts e.g. "%20" in a search query to a space-literal.
            // React-router offers no means by which one can differentiate if props are changing in this way,
            // so it's not really avoidable without completely scraping react-router's prop functionality.
            this.props.setSearchQuery(search === "" || typeof search === "undefined" ? undefined : decodeURIComponent(search));
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
    { addImages, logout, setFetchedAllImages: fetchedAllImages, addGlobalAPIError, setSearchQuery }
)(HomeView);