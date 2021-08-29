import ExtendableError from 'es6-error';

export let BASE_API_URL: string;
if (process.env.NODE_ENV === "development") {
    BASE_API_URL = "http://localhost:8001";
}
else {
    BASE_API_URL = window.location.origin;
}

interface Response {
    status: number,
    headers: any,
    [key: string]: any
}

export interface APIResponse {
    resp: Response|null,
    message: string,
    error?: boolean,
    [key: string]: any
};
export class AuthenticationError extends ExtendableError {}