import { ApolloCache, Observable } from '@apollo/client/core';
import { ApolloLink } from '@apollo/client/link/core';
import {
	checkFetcher,
	fallbackHttpConfig,
	HttpOptions,
	parseAndCheckHttpResponse,
	selectHttpOptionsAndBody,
	selectURI,
	serializeFetchParameter,
} from '@apollo/client/link/http';
import deepmerge from 'deepmerge';
import { dset } from 'dset';
import { meros } from 'meros';
import { nestie } from 'nestie';

export const createMultipartLink = (fetchParams?: HttpOptions) => {
	let {
		uri = '/graphql',
		// use default global fetch if nothing is passed in
		fetch: fetcher,
		includeExtensions,
		...requestOptions
	} = fetchParams || {};

	// dev warnings to ensure fetch is present
	checkFetcher(fetcher);

	//fetcher is set here rather than the destructuring to ensure fetch is
	//declared before referencing it. Reference in the destructuring would cause
	//a ReferenceError
	if (!fetcher) {
		fetcher = fetch;
	}

	const linkConfig = {
		http: { includeExtensions },
		options: requestOptions.fetchOptions,
		credentials: requestOptions.credentials,
		headers: requestOptions.headers,
	};

	return new ApolloLink((operation) => {
		let chosenURI = selectURI(operation, uri);
		const context = operation.getContext();

		const contextConfig = {
			http: context.http,
			options: context.fetchOptions,
			credentials: context.credentials,
			headers: {
				accept: 'application/json, multipart/mixed',
				...context.headers,
			},
		};

		const { body, options } = selectHttpOptionsAndBody(
			operation,
			fallbackHttpConfig,
			linkConfig,
			contextConfig,
		);

		return new Observable((observer) => {
			fetcher!(chosenURI, {
				...options,
				body: serializeFetchParameter(body, 'Payload'),
			})
				.then((response) => {
					operation.setContext({ response });
					return meros(response);
				})
				.then(async (parts) => {
					if (isAsyncIterable(parts)) {
						const cache = context.cache as ApolloCache<any>;
						let first = true;
						for await (const part of parts) {
							if (!part.json)
								throw new Error(
									`Expected part to be of json type but got:\n${part.headers}\n${part.body}`,
								);

							if (cache === undefined) {
								// @ts-ignore
								observer.next(part.body);
								continue;
							}

							// TODO: Fix types
							const payload = part.body as any;

							if (first) {
								observer.next(payload);
								first = false;
							} else {
								const data = cache.read({
									query: operation.query,
									variables: operation.variables,
									rootId: 'ROOT_QUERY',
									optimistic: false,
									returnPartialData: true,
								}) as object;

								const patch_data = nestie({
									[payload.path.join('.')]: payload.data,
								});

								const new_result = deepmerge(data, patch_data);

								cache.write({
									result: new_result,
									dataId: 'ROOT_QUERY',
									query: operation.query,
									variables: operation.variables,
								});

								observer.next(payload);
							}
						}
						return void observer.complete();
					}

					const result = await parseAndCheckHttpResponse(operation)(
						parts,
					);
					observer.next(result);
					return void observer.complete();
				});
		});
	});
};

function isAsyncIterable(
	input: unknown,
): input is AsyncIterableIterator<unknown> {
	return (
		typeof input === 'object' &&
		input !== null &&
		// The AsyncGenerator check is for Safari on iOS which currently does not have
		// Symbol.asyncIterator implemented
		// That means every custom AsyncIterable must be built using a AsyncGeneratorFunction (async function * () {})
		((input as any)[Symbol.toStringTag] === 'AsyncGenerator' ||
			(Symbol.asyncIterator && Symbol.asyncIterator in input))
	);
}
