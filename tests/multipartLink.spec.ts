import { InMemoryCache } from '@apollo/client/cache/cache.cjs';
import { ApolloClient } from '@apollo/client/core/core.cjs';
import { execute } from '@apollo/client/link/core';
import gql from 'graphql-tag';
import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { createMultipartLink } from '../src/multipartLink';
import { mockResponseNode } from './mocks';

const TEST_QUERY = gql`query TestQuery {
	user {
		id
		name @defer
	}
}`;

const patches = [
	{ data: { user: { id: 'random-id' } }, hasNext: true },
	{ data: { name: 'random-name' }, path: ['user'], hasNext: false },
];

// @ts-ignore
global['fetch'] = async function() {
	return mockResponseNode(patches, 'abc123');
};

test('execute', async () => {
	const collection = await new Promise((resolve, reject) => {
		const collection: any[] = [];

		execute(createMultipartLink(), { query: TEST_QUERY })
			.subscribe({
				next(data) {
					collection.push(data);
				},
				complete() {
					resolve(collection);
				},
				error(error) {
					reject(error);
				},
			});
	});

	assert.equal(collection, patches);
});

test.only('with client :: query', async () => {
	const client = new ApolloClient({
		cache: new InMemoryCache({ addTypename: false }),
		link: createMultipartLink(),
	});

	const { data } = await client.query({
		query: TEST_QUERY,
		returnPartialData: false,
	});

	assert.equal(data, {
		user: {
			id: 'random-id',
			name: 'random-name',
		},
	});
});

test.run();
