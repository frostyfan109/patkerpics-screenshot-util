import { applicationInterface, image, userData } from "./reducers/application";

export const SET_LOGGED_IN = "SET_LOGGED_IN";
export const SET_LOGGING_IN = "SET_LOGGING_IN";
export const SET_APPLICATION_STATE = "SET_APPLICATION_STATE";
export const ADD_IMAGES = "ADD_IMAGES";
export const REMOVE_IMAGE = "REMOVE_IMAGE";
export const UPDATE_IMAGE = "UPDATE_IMAGE";
export const FETCHED_ALL_IMAGES = "FETCHED_ALL_IMAGES";
export const ADD_GLOBAL_ERROR = "ADD_GLOBAL_ERROR";
export const UPDATE_USER_DATA = "UPDATE_USER_DATA";
export const SET_APPLICATION_DATA = "SET_APPLICATION_DATA";
export const SET_SEARCH_QUERY = "SET_SEARCH_QUERY";

export interface fetchedAllImagesAction {
    type: typeof FETCHED_ALL_IMAGES
};
export interface addImagesAction {
    type: typeof ADD_IMAGES,
    images: image[]
};
export interface removeImageAction {
    type: typeof REMOVE_IMAGE,
    image: image
};
export interface updateImageAction {
    type: typeof UPDATE_IMAGE,
    image: image
}
export interface setLoggedInAction {
    type: typeof SET_LOGGED_IN,
    loggedIn: boolean
};
export interface updateUserDataAction {
    type: typeof UPDATE_USER_DATA,
    userData: userData
}
export interface setLoggingInAction {
    type: typeof SET_LOGGING_IN
};
export type loginAction = setLoggedInAction | setLoggingInAction;

export interface setApplicationStateAction {
    type: typeof SET_APPLICATION_STATE,
    [key: string]: any
};