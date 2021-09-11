import { combineReducers } from 'redux';
import login from './login';
import application from './application';
import page from './page';

export default combineReducers({
    login,
    application,
    page
});