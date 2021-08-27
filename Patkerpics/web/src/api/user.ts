import axios from 'axios';
import EventSource from 'eventsource';
import io from 'socket.io-client';
import * as qs from 'qs';
import { BASE_API_URL, APIResponse, AuthenticationError } from '.';
import { image } from '../store/reducers/application';
import { LoremIpsum } from 'lorem-ipsum';
import Cookies from 'js-cookie';
import { login, logout } from '../store/actions';
import JwtDecode from 'jwt-decode';

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

export default class User {
    public static pollingImages: PollImages|null = null;
    // private static tokenRefreshCallbacks: Function[] = [];

    private static refreshing: boolean = false;
    private static refreshPromise: Promise<void> = Promise.resolve();

    public static get username(): string|undefined {
        return Cookies.get("username");
    }
    public static get accessToken(): string|undefined {
        return Cookies.get("access_token");
    }
    public static get refreshToken(): string|undefined {
        return Cookies.get("refresh_token");
    }
    public static get loggedIn() {
        return (
            this.username !== undefined &&
            this.accessToken !== undefined &&
            this.refreshToken !== undefined
        );
    }
    private static refresh(): Promise<void> {
        if (this.refreshing) return this.refreshPromise;
        this.refreshing = true;

        this.refreshPromise = new Promise(async (resolve, reject) => {
            if (this.accessToken === "undefined") {
                reject("Access token is undefined");
            }
            // If access token expires in less than 60 seconds refresh it
            else {
                const decoded = JwtDecode<{exp: number}>(this.accessToken as string);
                if ((decoded.exp - (Date.now() / 1000)) <= 30) {
                    try {
                        const accessToken = (await axios.post(BASE_API_URL + "/refresh", {}, {
                            headers: this.JWTRefreshHeader(),
                            withCredentials: true
                        })).data.access_token;
                        console.log("Refreshed access token");
                        Cookies.set("access_token", accessToken);
                    } catch (e) {
                        console.log("Authentication failed with error", e);
                        reject();
                    }
                }
            }
            resolve();
        });
        this.refreshPromise.then(() => {this.refreshing = false;});
        return this.refreshPromise;
    }
    public static async deleteImage(imageId: number): Promise<void> {
        await this.refresh();
        await axios.delete(BASE_API_URL + "/image/" + imageId, {
            headers: this.JWTAccessHeader()
        });
    }
    public static async getImage(imageId: number): Promise<image|null> {
        await this.refresh();
        const data: image|null = (await axios.get(BASE_API_URL + "/image/" + imageId, {
            headers: this.JWTAccessHeader()
        })).data;
        return data === null ? data : this.loadImage(data!);
    }
    public static async getImages(): Promise<image[]> {
        await this.refresh();
        const data: image[] = (await axios.get(BASE_API_URL + "/images", {
            headers: this.JWTAccessHeader()
        })).data.map((image: image) => this.loadImage(image));
        return data;
    }
    public static async setTitle(imageId: number, title: string): Promise<APIResponse> {
        await this.refresh();
        const data = (await axios.post(BASE_API_URL + "/image/" + imageId + "/modify", [
            {
                type: "setTitle",
                title

            }
        ], {
            headers: this.JWTAccessHeader()
        })).data;
        return {
            error: !data[0].success,
            message: data[0].message
        };
    }
    public static async changeTag(command: string, imageId: number, name: string): Promise<APIResponse> {
        await this.refresh();
        const data = (await axios.post(BASE_API_URL + "/image/" + imageId + "/modify", [
            {
                type: command,
                tag: name

            }
        ], {
            headers: this.JWTAccessHeader()
        })).data;
        // await new Promise((resolve) => setTimeout(() => resolve(), 2500));
        return {
            error: !data[0].success,
            message: data[0].message
        };
    }
    public static async addTag(imageId: number, name: string): Promise<APIResponse> {
        return User.changeTag("addTag", imageId, name);
    }
    public static async removeTag(imageId: number, name: string): Promise<APIResponse> {
        return User.changeTag("removeTag", imageId, name);
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
                socket.close();
                socket = undefined;
            }
        };
        this.pollingImages = {
            start,
            stop
        };
        this.pollingImages.start();
    }
    // Could shorten this by consolidating the overlapping login logic into a single function
    public static async register(username: string, email: string, password: string): Promise<APIResponse> {
        try {
            const response = await axios.post(BASE_API_URL + "/register", {
                username,
                email,
                password
            }, {
                withCredentials: true
            });
            const { access_token: accessToken, refresh_token: refreshToken, message } = response.data;
            Cookies.set("username", username);
            Cookies.set("access_token", accessToken);
            Cookies.set("refresh_token", refreshToken);
            return {
                message,
                error: false
            };
        }
        catch (error) {
            alert(error);
            return {
                message: error.response.data.message,
                error: true
            };
        }
    }
    public static async login(username: string, password: string): Promise<APIResponse> {
        try {
            const response = await axios.post(BASE_API_URL + "/login", {
                username,
                password
            }, {
                withCredentials: true
            });
            const { access_token: accessToken, refresh_token: refreshToken, message } = response.data;
            Cookies.set("username", username);
            Cookies.set("access_token", accessToken);
            Cookies.set("refresh_token", refreshToken);
            return {
                message,
                error: false
            };
        }
        catch (error) {
            alert(error);
            return {
                message: error.response.data.message,
                error: true
            };
        }
    }
    public static async logout(): Promise<void> {
        if (this.pollingImages !== null) {
            this.pollingImages.stop();
            this.pollingImages = null;
        }
        Cookies.remove("username");
        Cookies.remove("access_token");
        Cookies.remove("refresh_token");
        Cookies.remove("csrf_access_token");
        Cookies.remove("csrf_refresh_token");
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