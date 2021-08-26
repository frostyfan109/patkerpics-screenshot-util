import { combineReducers } from 'redux';
import login from './login';
import application from './application';

export default combineReducers({
    login,
    application
});