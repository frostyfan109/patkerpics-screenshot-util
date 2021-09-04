import { createSelector } from 'reselect';
import { applicationInterface, image } from '../reducers/application';

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

const getImageState = (state: any): image[] => state.application.images;

// This selector isn't actually viable, because the client doesn't necessarily
// have every image the user has uploaded loaded into memory, so it can't deduce
// total storage used.
export const getBytesUsed = createSelector(
    [getImageState],
    (images: image[]): number => {
        return images.reduce((acc, cur) => acc + cur.file_size, 0);
    }
)