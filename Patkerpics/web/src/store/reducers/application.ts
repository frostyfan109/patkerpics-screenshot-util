import { SET_APPLICATION_STATE, ADD_IMAGES, REMOVE_IMAGE, UPDATE_IMAGE, FETCHED_ALL_IMAGES, ADD_GLOBAL_ERROR } from '../actionTypes';

export interface image {
    id: number,
    uid: string,
    url: string,
    bit_depth: number,
    width: number,
    height: number,
    ocr_text: string,
    ocr_boxes: string,
    filename: string,
    file_size: number,
    timestamp: number,
    title: string,
    tags: string[],
    prev: number|null,
    next: number|null
};

export interface userData {
    username: string,
    email: string,
    created: number,
    bytes_used: number
};

export interface Keyword {
    name: string,
    score: number,
    // If a keyword is coerced into an existing tag, fuzzed is set to
    // true, fuzzed_score is set to the ratio between original_value
    // and tag, original_value is set to the original keyword, and
    // other_tags is set to other potential tags it could have been
    // fuzzed into.
    fuzzed: boolean,
    fuzzed_score: number,
    original_value?: string,
    // Currently not used anywhere. Not actually a Keyword array, but contains
    // the ratios between other tags and original_value, where `name` is other
    // tag names and `score` is their ratio.
    other_tags?: Keyword[]
}

export interface ErrorInfo {
    status_code?: number,
    substatus_code?: number,
    extra_info?: any,
    stack_trace?: string,
    jwt_authentication_error?: boolean
};

export interface ApplicationError {
    title: string,
    message: string,
    stack_trace?: string
};

export interface applicationInterface {
    images: image[],
    userData: userData | null
    fetchedAllImages: boolean,
    errors: ApplicationError[]
};

export const initialState: applicationInterface = {
    images: [],
    userData: null,
    fetchedAllImages: false,
    errors: []
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
        case ADD_GLOBAL_ERROR: {
            const { type, applicationError } = action;
            return {
                ...state,
                errors: state.errors.concat(applicationError)
            };
        }
        default:
            return state;
    }
}