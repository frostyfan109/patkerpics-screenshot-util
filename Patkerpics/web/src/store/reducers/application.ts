import { SET_APPLICATION_STATE, ADD_IMAGES, REMOVE_IMAGE, UPDATE_IMAGE, FETCHED_ALL_IMAGES } from '../actionTypes';

export interface image {
    id: number,
    url: string,
    timestamp: number,
    title: string,
    tags: string[],
    prev: number|null,
    next: number|null
};

export interface applicationInterface {
    images: image[],
    fetchedAllImages: boolean
};

export const initialState: applicationInterface = {
    images: [],
    fetchedAllImages: false
};

export default function applicationReducer(state: applicationInterface = initialState, action: any) {
    switch (action.type) {
        case SET_APPLICATION_STATE: {
            const { type, ...applicationState } = action;
            return {
                ...state,
                ...applicationState
            };
        }
        case ADD_IMAGES: {
            const { type, images } = action;
            const ids: number[] = state.images.map((image: image) => image.id);
            return {
                ...state,
                images: state.images.concat(images.filter((image: image) => ids.indexOf(image.id) === -1))

            };
        }
        case REMOVE_IMAGE: {
            const { type, image: removed } = action;
            return {
                ...state,
                images: state.images.filter((image: image) => image.id !== removed.id)
            };
        }
        case UPDATE_IMAGE: {
            const { type, image: updated } = action;
            return {
                ...state,
                images: state.images.map((image: image) => {
                    if (image.id === updated.id) {
                        // Don't reload url
                        updated.url = image.url;
                        return updated;
                    }
                    return image;
                })
            };
        }
        case FETCHED_ALL_IMAGES: {
            return {
                ...state,
                fetchedAllImages: true
            };
        }
        default:
            return state;
    }
}