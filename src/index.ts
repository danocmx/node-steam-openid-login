import axios, { AxiosError } from 'axios';
import cheerio from 'cheerio';
import FormData from 'form-data';

export type SteamOpenIdLoginOptions = {
    /**
     * Url you're authenticating via openid
     */
    url: string;
    /**
     * String array with cookies
     * format: cookiename1=cookievalue1
     */
    cookies: string[];
}

/**
 * A simple login function to get cookies for target openid website.
 * @return Returns cookies from steam and said openid website we logged into.
 */
export async function login({ url, cookies }: SteamOpenIdLoginOptions): Promise<string[]> {
    try {
        const cookiesArray = [...cookies]; // Cloned
        const cookiesString = cookies.join('; ');

        const { data } = await axios({
            url,
            headers: {
                Cookie: cookiesString
            }
        });

        const $ = cheerio.load(data);

        if ($('#loginForm').length !== 0) {
            throw new Error('You are not signed in to Steam.');
        }

        const form = $('#openidForm');

        if (form.length !== 1) {
            throw new Error('Could not find OpenId login form.');
        }

        const formData = getOpenIdFormData(form);

        const { headers } = await axios({
            method: 'POST',
            url: 'https://steamcommunity.com/openid/login',
            headers: {
                Cookie: cookiesString,
                'Content-Type': 'multipart/form-data'
            },
            data: formData
        });

        const responseCookieString = headers['Set-Cookie'];
        const responseCookieArray = responseCookieString.split('; ');

        return [...cookiesArray, ...responseCookieArray];
    } catch (e) {
        if (!isAxiosError(e)) {
            throw e;
        }

        if (!redirectedToSteam(e.response?.request.url.host)) {
            throw new Error('Was not redirected to steam, make sure the url is correct.');
        }

        throw e;
    }
}

function getOpenIdFormData(form: cheerio.Cheerio) {
    const formData = new FormData();
    const inputs = form.find('input');
    inputs.each((_i, element: cheerio.TagElement|cheerio.TextElement) => {
        if (isTagElement(element)) {
            const name = element.attribs.name;
            const value = element.attribs.value;
            formData.append(name, value);
        }
    });

    return formData;
}

function isAxiosError(e: any): e is AxiosError {
    return !!(e && e.isAxiosError);
}

function isTagElement(element: cheerio.TagElement|cheerio.TextElement): element is cheerio.TagElement {
    return Object.prototype.hasOwnProperty.call(element, 'attribs');
}

function redirectedToSteam(host: string) {
    return host === 'steamcommunity.com';
}
