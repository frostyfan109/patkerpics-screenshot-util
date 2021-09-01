export function sleep(time: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, time)
    });
}

type ImageType = HTMLImageElement | Blob | string;

export class ImageCache {
    private static imageCache: { [key: string]: ImageType[]} = {};
    public static cache(key: string, image: ImageType): void {
        if (!this.imageCache.hasOwnProperty(key)) {
            // If key doesn't exist for any cached images, add it.
            this.imageCache[key] = [image];
        } else if (!this.imageCache[key].some((im: ImageType) => im.constructor.name === image.constructor.name)) {
            // Else if this data type for the image key isn't cached yet, add it.
            this.imageCache[key].push(image)
        }
    }
    public static get(key: string, preferredType: any): ImageType|null {
        if (!this.imageCache.hasOwnProperty(key)) return null;
        const prefType = this.imageCache[key].find((im) => im.constructor.name === preferredType.name);
        if (prefType) return prefType;
        else return this.imageCache[key][0];
        // return this.imageCache[key];
    }
    public static getAll(key: string): ImageType[]|null {
        if (!this.imageCache.hasOwnProperty(key)) return null;
        return this.imageCache[key];
    }
    public static uncache(key: string): void {
        delete this.imageCache[key];
    }
}