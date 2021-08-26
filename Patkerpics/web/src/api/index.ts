import ExtendableError from 'es6-error';

export let BASE_API_URL: string;
if (process.env.NODE_ENV === "development") {
    BASE_API_URL = "http://localhost:8001";
}
else {
    BASE_API_URL = window.location.origin;
}
export interface APIResponse {
    message?: string,
    error: boolean
};
export class AuthenticationError extends ExtendableError {}