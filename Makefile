docker-build:
	docker build --no-cache -t labdigital/commercetools-utilities-javascript:latest .

docker-release:
	docker push labdigital/commercetools-utilities-javascript:latest

test:
	pnpm test


check:
	node_modules/typescript/bin/tsc
	pnpm run test
	pnpm run lint
