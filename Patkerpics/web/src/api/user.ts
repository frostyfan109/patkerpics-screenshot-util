import axios from 'axios';
import io from 'socket.io-client';
import * as qs from 'qs';
import { BASE_API_URL, APIResponse, AuthenticationError } from '.';
import { image, userData, Keyword } from '../store/reducers/application';
import { store } from '../store';
import { LoremIpsum } from 'lorem-ipsum';
import Cookies from 'js-cookie';
import JwtDecode from 'jwt-decode';
import { addGlobalAPIError, addGlobalError } from '../store/actions';

type updateImage = (image: image) => void;
type addImage = (image: image) => void;
type removeImage = (image: image) => void;
// type setInitialImages = (images: image[]) => void;
type authenticationFailed = () => void;

export interface Callbacks {
    authenticationFailed: authenticationFailed,
    addImage: addImage,
    removeImage: removeImage,
    updateImage: updateImage,
    // setInitialImages: setInitialImages
};

interface PollImages {
    start: () => void,
    stop: () => void
};

interface Operations {
    // refreshTokenInterval: number,
    pollImages: PollImages
};

interface OCRData {
    ocr_text: string
    ocr_boxes: string
}

interface JWTHeader {
    Authorization: string
};

const li = new LoremIpsum({
    sentencesPerParagraph: {
        max: 8,
        min: 4
    },
    wordsPerSentence: {
        max: 16,
        min: 4
    }
});

interface GetImagesResponse extends APIResponse {
    images: image[]
}
interface ExtractKeywordsResponse extends APIResponse {
    keywords: Keyword[]
}

let refreshTokenInterval: NodeJS.Timeout;

export default class User {
    public static pollingImages: PollImages|null = null;
    // private static tokenRefreshCallbacks: Function[] = [];

    private static refreshing: boolean = false;
    private static refreshPromise: Promise<void> = Promise.resolve();

    public static _socket?: SocketIOClient.Socket;

    public static get accessToken(): string|undefined {
        return Cookies.get("access_token");
    }
    public static set accessToken(value: string|undefined) {
        Cookies.set("access_token", (value as any));
        if (this._socket && this._socket.io.opts.transportOptions) {
            (this._socket.io.opts.transportOptions as any).polling.extraHeaders = this.JWTAccessHeader();
            (this._socket.io.opts.transportOptions as any).polling.extraHeaders.foobar = 1234132234;
        }
    }
    public static get refreshToken(): string|undefined {
        return Cookies.get("refresh_token");
    }
    public static set refreshToken(value: string|undefined) {
        Cookies.set("refresh_token", (value as any));
    }
    public static get loggedIn() {
        return (
            // this.username !== undefined &&
            this.accessToken !== undefined &&
            this.refreshToken !== undefined
        );
    }
    public static refresh(force=false): Promise<Error|void> {
        if (this.refreshing) return this.refreshPromise;
        if (!this.loggedIn) return Promise.resolve();
        this.refreshing = true;
        // return Promise.resolve();
        console.log("refreshing");

        this.refreshPromise = new Promise(async (resolve, reject) => {
            // if (this.accessToken === "undefined") {
            //     reject(new AuthenticationError("Access token is undefined."));
            // }
            // If force enabled or access token expires in less than 60 seconds refresh it
            const decoded = JwtDecode<{exp: number}>(this.accessToken as string);
            if (force || (decoded.exp - (Date.now() / 1000)) <= 60) {
                if (force) console.log("Forced token refresh.");
                try {
                    const resp = (await axios.post(BASE_API_URL + "/refresh", {}, {
                        headers: this.JWTRefreshHeader(),
                        // withCredentials: true
                    }));
                    const { message, error, access_token: accessToken, refresh_token: refreshToken } = resp.data;
                    console.log(message);
                    if (!error) {
                        this.accessToken = accessToken;
                        this.refreshToken = refreshToken;
                    }
                } catch (e) {
                    console.log(e)
                }
            }
            resolve();
        });
        this.refreshPromise.then(() => {this.refreshing = false;});
        return this.refreshPromise;
    }
    @APIRequest()
    public static async clearOCR(imageId: number): Promise<APIResponse> {
        const resp  = (await axios(BASE_API_URL + "/ocr/clear/" + imageId, {
            method: "POST",
            headers: this.JWTAccessHeader(),
            withCredentials: true
        }));
        const { message, error, error_info } = resp.data;
        return {
            resp,
            message,
            error,
            error_info
        };
    }
    @APIRequest()
    public static async scanOCR(imageId: number, rescan: boolean=false): Promise<APIResponse> {
        // const resp  = (await axios.post(BASE_API_URL + "/ocr/" + imageId, {
        //     headers: this.JWTAccessHeader(),
        //     withCredentials: true
        // }));
        // Strange bug with Axios causes it not to send cookies when making POST requests
        // despite having `withCredentials: true`/"credentials: include" set, but it
        // doesn't happen when manually setting the method in the config.
        const resp  = (await axios(BASE_API_URL + "/ocr/" + imageId + "?" + qs.stringify({ rescan }), {
            method: "POST",
            headers: this.JWTAccessHeader(),
            withCredentials: true
        }));
        const { message, error, error_info, ocr_text: OCRText, ocr_boxes: OCRBoxes } = resp.data;
        return {
            resp,
            message,
            error,
            error_info,
            OCRText,
            OCRBoxes
        };
        
    }
    @APIRequest()
    public static async extractKeywords(imageId: number, fuzzyScoreCutoff: number=1.0): Promise<ExtractKeywordsResponse> {
        const resp = (await axios.get(BASE_API_URL + "/extract_keywords/" + imageId + "?" + qs.stringify({ "fuzzy_comparison_cutoff": fuzzyScoreCutoff }), {
            headers: this.JWTAccessHeader(),
            withCredentials: true
        }));
        const { message, error, error_info, keywords } = resp.data;
        return {
            resp,
            message,
            error,
            error_info,
            keywords
        }
    }
    @APIRequest()
    public static async getUserData(): Promise<APIResponse> {
        const resp = (await axios.get(BASE_API_URL + "/user_data", {
            headers: this.JWTAccessHeader(),
            withCredentials: true
        }));
        const { message, error, error_info, user_data: userData } = resp.data;
        return {
            resp,
            message,
            error,
            error_info,
            userData
        };
    }
    @APIRequest()
    public static async deleteImage(imageId: number): Promise<APIResponse> {
        const resp = (await axios.delete(BASE_API_URL + "/image/" + imageId, {
            headers: this.JWTAccessHeader(),
            withCredentials: true
        }));
        return {
            resp,
            ...resp.data
        };
    }
    @APIRequest()
    public static async getImage(imageId: number): Promise<APIResponse> {
        const response = (await axios.get(BASE_API_URL + "/image/" + imageId, {
            headers: this.JWTAccessHeader(),
            withCredentials: true
        }));
        if (response.data.error) return response.data;
        else {
            return {
                resp: response,
                message: response.data.message,
                error: response.data.error,
                image: this.loadImage(response.data.image)
            };
        }
        // return data === null ? data : this.loadImage(data!);
    }
    
    @APIRequest()
    public static async getImages(): Promise<GetImagesResponse> {
        const resp = (await axios.get(BASE_API_URL + "/images", {
            headers: this.JWTAccessHeader(),
            withCredentials: true
        }));
        const { message, error, error_info, images }: GetImagesResponse = resp.data;
        if (error) return {
            resp,
            message,
            error,
            error_info,
            images: []
        };
        else return {
            resp,
            message,
            error,
            images: images.map((image: image) => this.loadImage(image))
        };
    }
    @APIRequest()
    public static async setTitle(imageId: number, title: string): Promise<APIResponse> {
        const resp = (await axios.post(BASE_API_URL + "/image/" + imageId + "/modify", {
            type: "setTitle",
            title
        }, {
            headers: this.JWTAccessHeader(),
            withCredentials: true
        }));
        return {
            resp,
            ...resp.data
        };
    }
    @APIRequest()
    public static async modifyImage(command: string, imageId: number, payload: object): Promise<APIResponse> {
        const resp = (await axios.post(BASE_API_URL + "/image/" + imageId + "/modify", {
            type: command,
            ...payload
        }, {
            headers: this.JWTAccessHeader(),
            withCredentials: true
        }));
        return {
            resp,
            ...resp.data
        };
    }
    public static async addTags(imageId: number, tags: string[]): Promise<APIResponse> {
        return User.modifyImage("addTags", imageId, {
            tags
        })
    }
    public static async addTag(imageId: number, name: string): Promise<APIResponse> {
        return User.modifyImage("addTag", imageId, {
            tag: name
        });
    }
    public static async removeTag(imageId: number, name: string): Promise<APIResponse> {
        return User.modifyImage("removeTag", imageId, {
            tag: name
        });
    }
    @APIRequest()
    public static async loadImageAsBlob(url: string, loadingCallback?: Function): Promise<APIResponse> {
        try {
            // Axois does not support streamed requests
            const resp = await fetch(url, {
                method: "GET",
                headers: (this.JWTAccessHeader() as any),
                credentials: "include"
            });
            const body = await resp.body;
            const reader = body!.getReader();
            var done = false;
            var value_buffer: Uint8Array = new Uint8Array();
            while (!done) {
                var { done, value } = await reader.read();
                // Value is undefined upon completion
                if (!value) continue;
                // Concat buffers
                const old_buffer = value_buffer;
                value_buffer = new Uint8Array(old_buffer.length + value.length);
                value_buffer.set(old_buffer);
                value_buffer.set(value, old_buffer.length);
                loadingCallback && loadingCallback(new Blob([value_buffer.buffer]));
            }
            return {
                resp,
                message: "Successfully downloaded image.",
                data: new Blob([value_buffer])
            };

        } catch (e) {
            // If Fetch isn't supported, fallback to an unstreamed Axios request (XMLHttpRequest).
            // This will load the entire image at once, which is more jarring and makes load times
            // feel longer.
            console.log("Streamed fetch falling back to Axios request.", e);
            const resp = (await axios.get(url, {
                responseType: "blob",
                headers: this.JWTAccessHeader()
            }));
            return {
                resp,
                message: "Successfully downloaded image. Fellback to Axios.",
                data: resp.data
            }
        }
    }
    private static loadImage(image: image): image {
        // Create image reference from image id
        // const data = (await axios.get(BASE_API_URL + "/image/" + image.id, {
        //     responseType: "arraybuffer",
        //     headers: this.JWTAccessHeader()
        // })).data;
        // const url = URL.createObjectURL(new Blob([data]));
        // image.url = BASE_API_URL + "/raw_image/" + image.uid + "?" + qs.stringify({ jwt : this.accessToken });
        image.url = BASE_API_URL + "/raw_image/" + image.uid;
        return image;
    }
    public static pollImages(
        addImage: addImage,
        removeImage: removeImage,
        updateImage: updateImage,
        authenticationFailed: (error: AuthenticationError) => void
    ): void {
        let socket: SocketIOClient.Socket|undefined;
        const start = () => {
            this.refresh().then(() => {
                socket = io(BASE_API_URL, {
                    transportOptions: {
                        polling: {
                            extraHeaders: this.JWTAccessHeader()
                        },
                    }
                });
                this._socket = socket;
                socket.on("connect_error", () => {
                    this.refresh(true);
                });
                // const errorHandle = () => {
                //     console.log("Handling socket connection error");
                //     stop();
                //     start();
                // };
                // socket.on("reconnect_failed", errorHandle);
                // socket.on("connect_failed", errorHandle);
                // socket.on("reconnect_error", errorHandle);
                // socket.on("connect_error", errorHandle);
                // socket.on("initialState", async (images: image[]) => {
                //     for (let i=0;i<images.length;i++) {
                //         images[i] = await loadImage(images[i]);
                //     }
                //     setInitialImages(images);
                // });
                
                // Set an interval to refresh the JWT access token every 5 minutes.
                // Since the token is only refreshed when requests are made to the API,
                // if the client goes however long access expiration is without making a
                // request it will expire before it can be refreshed.
                refreshTokenInterval = setInterval(() => {
                    this.refresh(true);
                }, 1000 * 60 * 5);
                socket.on("addImage", async (image: image) => {
                    console.log("Received add image event");
                    addImage(this.loadImage(image));
                });
                socket.on("removeImage", async (image: image) => {
                    removeImage(image);
                });
                socket.on("updateImage", async (image: image) => {
                    console.log("Received update image event");
                    updateImage(image);
                });
            }).catch((error: AuthenticationError) => {
                authenticationFailed(error);
            });
        };
        const stop = () => {
            if (socket !== undefined) {
                console.log("Terminating");
                clearInterval(refreshTokenInterval);
                socket.close();
                socket = undefined;
                this._socket = undefined;
            }
        };
        this.pollingImages = {
            start,
            stop
        };
        this.pollingImages.start();
    }
    @APIRequest()
    // Could shorten this by consolidating the overlapping login logic into a single function
    public static async register(username: string, email: string, password: string): Promise<APIResponse> {
        const response = await axios.post(BASE_API_URL + "/register", {
            username,
            email,
            password
        }, {
            withCredentials: true
        });
        const { message, error, error_info, access_token: accessToken, refresh_token: refreshToken } = response.data;
        // Cookies.set("username", username);
        if (!error) {
            this.accessToken = accessToken;
            this.refreshToken = refreshToken;
        }
        return {
            resp: response,
            message,
            error,
            error_info,
            accessToken,
            refreshToken
        };
    }
    @APIRequest()
    public static async login(username: string, password: string): Promise<APIResponse> {
        const response = await axios.post(BASE_API_URL + "/login", {
            username,
            password
        }, {
            withCredentials: true
        });
        const { message, error, error_info, access_token: accessToken, refresh_token: refreshToken, user_data: userData } = response.data;
        // Cookies.set("username", username);
        // Cookies.set("user_data", JSON.stringify(userData));
        if (!error) {
            this.accessToken = accessToken;
            this.refreshToken = refreshToken;
        }
        return {
            resp: response,
            message,
            error,
            error_info,
            accessToken,
            refreshToken
        };
    }
    public static async logout(): Promise<void> {
        if (this.pollingImages !== null) {
            this.pollingImages.stop();
            this.pollingImages = null;
        }
        // Cookies.remove("username");
        Cookies.remove("access_token");
        Cookies.remove("refresh_token");
        Cookies.remove("csrf_access_token");
        Cookies.remove("csrf_refresh_token");
        Cookies.remove("access_token_cookie");
        Cookies.remove("refresh_token_cookie");
        Cookies.remove("user_data");
    }
    // public static async getImages(): Promise<image[]> {
    //     const images: image[] = (await axios.get(BASE_API_URL + "/images", {
    //         headers: this.JWTAccessHeader()
    //     })).data;
    //     for (let i=0;i<images.length;i++) {
    //         const image: image = images[i];
    //         // Convert timestamp to ms for usage with Date API
    //         image.timestamp *= 1000;
            
    //         // Create image reference from image id
    //         const data = (await axios.get(BASE_API_URL + "/image/" + image.id, {
    //             responseType: "arraybuffer",
    //             headers: this.JWTAccessHeader()
    //         })).data;
    //         const url = URL.createObjectURL(new Blob([data]));
    //         image.url = url;

    //     }
    //     return images;
    // }
    private static JWTHeader(token: string): JWTHeader {
        return {
            Authorization: "Bearer " + token
        };
    }
    private static JWTAccessHeader(): JWTHeader {
        return this.JWTHeader(this.accessToken!);
    }
    private static JWTRefreshHeader(): JWTHeader {
        return this.JWTHeader(this.refreshToken!);
    }
};

function APIRequest(refresh: boolean=true): Function {
    return (target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
        const method = descriptor.value;
    
        descriptor.value = async function(...args: any[]) {
            // if (refresh) {
            //     const possibleError = await User.refresh();
            //     if (typeof possibleError !== "undefined") {
            //         store.dispatch(addGlobalError({
            //             title: "Authentication Error",
            //             message: possibleError.message,
            //             stack_trace: possibleError.stack
            //         }));
            //         // Refresh token has expired.
            //         User.logout();
            //     }
            // }
            let response: APIResponse;
            try {
                response = await method.apply(this, args);
                const newAccessToken = response.resp!.headers["update-access-token"];
                const newRefreshToken = response.resp!.headers["update-refresh-token"];
                if (newAccessToken) {
                    User.accessToken = newAccessToken;
                    console.log("Updated access token automatically.");
                }
                if (newRefreshToken) {
                    User.refreshToken = newRefreshToken;
                    console.log("Updated refresh token automatically.");
                }
                // Access tokens are automatically refreshed after each request, so as long as a valid
                // refresh token is sent, the response will go through the next attempt.
                // Curruently, this has no use an isn't actually functional.
                // if (response.error && response.error_info && response.error_info.jwt_authentication_error) {
                //     console.log("Second attempt");
                //     response = await method.apply(this, args);
                //     console.log("Second attempt:", response);
                // }
            } catch (e) {
                response = {
                    resp: null,
                    message: e.message,
                    error: true,
                    error_info: {
                        stack_trace: e.stack
                    }
                };

                // Dispatch a global error if an API request method fails altogether.
                // Intended behavior is that a response indicates that it has failed
                // in its payload rather than throwing an error, so something must go
                // very wrong (like API being unavailable) in order to throw an error.
                // store.dispatch(addGlobalError({
                //     title: "Request Error",
                //     message: e.message,
                //     stack_trace: e.stack
                // }));
                // store.dispatch(addGlobalAPIError(response));
            }
            /* This should never happen as long as refresh is called prior to making a request. */
            // if (response.error && response.error_info && response.error_info.jwt_authentication_error) {
            //     console.log("Invalid JWT credentials.");
            //     console.log("Request made with expired credentials. Refreshing and reexecuting request.");
            // }
            return response;
        };
        return descriptor;
    }
}