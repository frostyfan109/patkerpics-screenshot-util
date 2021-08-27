import { createSelector } from 'reselect';
import { applicationInterface } from '../reducers/application';

const getApplicationState = (state: any): applicationInterface => state.application;

export const getApplicationLoading = createSelector(
    [getApplicationState],
    (applicationState: applicationInterface) => {
        return (
            !applicationState.fetchedAllImages || 
            // applicationState.images === null ||
            applicationState.userData === null
        );
    }
);