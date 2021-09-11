import { SET_APPLICATION_DATA, SET_SEARCH_QUERY } from '../actionTypes';

export type QualifierType = "string" | "date";

export interface SearchQualifiers {
    // Qualifier -> type string
    [qualifier: string]: QualifierType
};

/* ApplicationData is loaded regardless of application state (logged in/logged out). */
export interface ApplicationData {
    /* Search-related fields and data used by the application */
    search: {
        // Qualifiers for pattern searching (i.e. "app" in "app:Google+Chrome")
        search_qualifiers: SearchQualifiers,
        // Pattern used to group qualifiers and values in a search query
        qualifier_pattern: string,
    }
};

interface PageInterface {
    applicationData: ApplicationData | null,
    searchQuery?: string
};

export const initialState: PageInterface = {
    applicationData: null,
    searchQuery: undefined
};

export default function pageReducer(state: PageInterface = initialState, action: any) {
    switch (action.type) {
        case SET_APPLICATION_DATA: {
            const { type, applicationData } = action;
            return {
                ...state,
                applicationData
            };
        }
        case SET_SEARCH_QUERY: {
            const { type, searchQuery } = action;
            return {
                ...state,
                searchQuery
            };
        }
        default:
            return state;
    }
}