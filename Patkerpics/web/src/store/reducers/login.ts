import Cookies from 'js-cookie';
import { SET_LOGGED_IN, SET_LOGGING_IN, loginAction } from '../actionTypes';
import User from '../../api/user';

export interface loginInterface {
    loggingIn: boolean,
    loggedIn: boolean
};

export const initialState: loginInterface = {
    loggingIn: false,
    loggedIn: false
};

export default function loginReducer(state: loginInterface = initialState, action: loginAction) {
    switch (action.type) {
        case SET_LOGGED_IN: {
            const { type, loggedIn } = action;
            return {
                ...state,
                loggedIn,
                loggingIn: false
            };
        }
        case SET_LOGGING_IN: {
            const { type } = action;
            return {
                ...state,
                loggingIn: true
            };
        }
        default:
            return state;
    }
}
