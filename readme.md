# apollo-link-multipart

---

<p align="center"><strong>IMPORTANT</strong></p>

<p align="center">Apollo aim to <a href="https://github.com/apollographql/apollo-client/blob/main/ROADMAP.md#after-apollo-client-30">support this natively</a> after v3 so this library be be mute soon.</p>

---

> An ApolloLink aimed at supporting `@defer` through multipart responses.

## ⚙️ Install

```sh
yarn add apollo-link-multipart
```

## 🚀 Usage

```ts
import { ApolloClient } from '@apollo/client/core';
import { ApolloLink } from '@apollo/client/link/core';

const client = new ApolloClient({
	cache: new InMemoryCache(),
	link: ApolloLink.from([
		// takes all the options from HttpLink
		createMultipartLink(),
	]),
});
```

## Related

-   [meros](https://github.com/maraisr/meros) A fast utility for reading
    streamed multipart/mixed responses.

## License

MIT © [Marais Rossouw](https://marais.io)
