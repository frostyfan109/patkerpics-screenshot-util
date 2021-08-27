import { ThunkAction, ThunkDispatch } from 'redux-thunk';
import { LoremIpsum } from 'lorem-ipsum';
import { 
    SET_LOGGED_IN, setLoggedInAction, SET_LOGGING_IN, setLoggingInAction,
    SET_APPLICATION_STATE, setApplicationStateAction, addImagesAction,
    ADD_IMAGES, removeImageAction, REMOVE_IMAGE, updateImageAction,
    UPDATE_IMAGE, fetchedAllImagesAction, FETCHED_ALL_IMAGES
} from './actionTypes';
import User, { Callbacks } from '../api/user';
import Cookies from 'js-cookie';
import { initialState as initialLoginState } from './reducers/login';
import { applicationInterface, initialState as defaultApplicationState, image } from './reducers/application';
import { async } from 'q';
import { APIResponse, AuthenticationError } from '../api';

export function setLoggingIn(): setLoggingInAction {
    return {
        type: SET_LOGGING_IN
    };
}

function setApplicationState(applicationState: object): setApplicationStateAction {
    return {
        type: SET_APPLICATION_STATE,
        ...applicationState
    };
}

export function fetchApplicationState(): ThunkAction<Promise<void>, any, any, any> {
    return async (dispatch: ThunkDispatch<any, any, any>, getState: Function) => {
        // dispatch(setApplicationState({
        //     images: await User.getImages()
        // }));
    }
}
export function pageLoad(): ThunkAction<Promise<void>, any, any, any> {
    return async (dispatch: ThunkDispatch<any, any, any>) => {
        if (User.loggedIn) {
            dispatch(authenticateLogin());
        }
    }
}
function authenticateLogin(): ThunkAction<Promise<void>, any, any, any> {
    return async (dispatch: ThunkDispatch<any, any, any>, getState: Function) => {
        dispatch(setLoggedIn(true));
        const authenticationFailed = (error: AuthenticationError): void => { dispatch(logout()); };
        User.pollImages(
            (newImage: image): void => {
                console.log("add image");
                dispatch(addImage(newImage));
            },
            (removed: image): void => {
                console.log("remove image");
                dispatch(removeImage(removed));
            },
            (updatedImage: image): void => {
                console.log("update image");
                dispatch(updateImage(updatedImage));
            },
            // (images: image[]): void => {
            //     dispatch(setApplicationState({
            //         images: images
            //     }));
            // },
            authenticationFailed
        );
    }
}

export function fetchedAllImages(): fetchedAllImagesAction {
    return { type: FETCHED_ALL_IMAGES };
}

export function addImage(image: image): addImagesAction {
    return addImages([image]);
}

export function addImages(images: image[]): addImagesAction {
    return {
        type: ADD_IMAGES,
        images
    };
}

export function removeImage(image: image): removeImageAction {
    return {
        type: REMOVE_IMAGE,
        image
    };
}

export function updateImage(image: image): updateImageAction {
    return {
        type: UPDATE_IMAGE,
        image
    };
}

export function setImages(images: image[]): setApplicationStateAction {
    return setApplicationState({
        images
    });
}

export function setLoggedIn(loggedIn: boolean): setLoggedInAction {
    return {
        type: SET_LOGGED_IN,
        loggedIn
    };
}
export function register(username: string, email: string, password: string): ThunkAction<Promise<APIResponse>, any, any, any> {
    return async (dispatch: ThunkDispatch<any, any, any>) => {
        dispatch(setLoggingIn());
        const response: APIResponse = await User.register(username, email, password);
        if (!response.error) {
            dispatch(authenticateLogin());
        }
        return response;
    }
}
export function login(username: string, password: string): ThunkAction<Promise<APIResponse>, any, any, any> {
    return async (dispatch: ThunkDispatch<any, any, any>) => {
        dispatch(setLoggingIn());
        const response: APIResponse = await User.login(username, password);
        if (!response.error) {
            dispatch(authenticateLogin());
        }
        return response;
    }
}
export function logout(): Function {
    return (dispatch: Function): void => {
        dispatch(setLoggedIn(false));
        User.logout();
        dispatch(setApplicationState(defaultApplicationState));
    }
}
export function loggingIn(): setLoggingInAction {
    return {
        type: SET_LOGGING_IN
    }
}