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
				...context.headers,
				accept: 'application/json, multipart/mixed',
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
					if (parts[Symbol.asyncIterator] < 'u') {
						const cache = context.cache as ApolloCache<any>;
						let first = true;
						for await (const part of parts) {
							if (cache === undefined) {
								observer.next(part);
								continue;
							}

							if (first) {
								observer.next({
									data: part.data,
								});
								first = false;
							} else {
								const patch_data = nestie({
									[part.path.join('.')]: part.data,
								});
								const original_data = cache.read({
									query: operation.query,
									variables: operation.variables,
									rootId: 'ROOT_QUERY',
									optimistic: false,
									returnPartialData: true,
								});

								const new_result = deepmerge(
									original_data,
									patch_data,
								);

								cache.write({
									result: new_result,
									dataId: 'ROOT_QUERY',
									query: operation.query,
									variables: operation.variables,
								});

								observer.next({
									data: part.data,
								});
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
