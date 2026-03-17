/** Injectable HTTP client — abstracts Obsidian's requestUrl(). */
export interface IHttpClient {
	request(options: HttpRequestOptions): Promise<HttpResponse>;
}

export interface HttpRequestOptions {
	url: string;
	method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
	headers?: Record<string, string>;
	body?: string;
}

export interface HttpResponse {
	json: unknown;
	status: number;
	headers: Record<string, string>;
}
