/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import { IExpression } from 'vs/base/common/glob';
import * as paths from 'vs/base/common/paths';
import { URI as uri } from 'vs/base/common/uri';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { TestConfigurationService } from 'vs/platform/configuration/test/common/testConfigurationService';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { IFolderQuery, IPatternInfo, QueryType, ITextQuery, IFileQuery } from 'vs/platform/search/common/search';
import { IWorkspaceContextService, toWorkspaceFolders, Workspace } from 'vs/platform/workspace/common/workspace';
import { ISearchPathsResult, QueryBuilder } from 'vs/workbench/parts/search/common/queryBuilder';
import { TestContextService, TestEnvironmentService } from 'vs/workbench/test/workbenchTestServices';

const DEFAULT_EDITOR_CONFIG = {};
const DEFAULT_USER_CONFIG = { useRipgrep: true, useIgnoreFiles: true, useGlobalIgnoreFiles: true };
const DEFAULT_QUERY_PROPS = {};
const DEFAULT_TEXT_QUERY_PROPS = { usePCRE2: false };

suite('QueryBuilder', () => {
	const PATTERN_INFO: IPatternInfo = { pattern: 'a' };
	const ROOT_1 = fixPath('/foo/root1');
	const ROOT_1_URI = getUri(ROOT_1);

	let instantiationService: TestInstantiationService;
	let queryBuilder: QueryBuilder;
	let mockConfigService: TestConfigurationService;
	let mockContextService: TestContextService;
	let mockWorkspace: Workspace;

	setup(() => {
		instantiationService = new TestInstantiationService();

		mockConfigService = new TestConfigurationService();
		mockConfigService.setUserConfiguration('search', DEFAULT_USER_CONFIG);
		mockConfigService.setUserConfiguration('editor', DEFAULT_EDITOR_CONFIG);
		instantiationService.stub(IConfigurationService, mockConfigService);

		mockContextService = new TestContextService();
		mockWorkspace = new Workspace('workspace', toWorkspaceFolders([{ path: ROOT_1_URI.fsPath }]));
		mockContextService.setWorkspace(mockWorkspace);

		instantiationService.stub(IWorkspaceContextService, mockContextService);
		instantiationService.stub(IEnvironmentService, TestEnvironmentService);

		queryBuilder = instantiationService.createInstance(QueryBuilder);
	});

	test('simple text pattern', () => {
		assertEqualTextQueries(
			queryBuilder.text(PATTERN_INFO),
			{
				folderQueries: [],
				contentPattern: PATTERN_INFO,
				type: QueryType.Text
			});
	});

	test('folderResources', () => {
		assertEqualTextQueries(
			queryBuilder.text(
				PATTERN_INFO,
				[ROOT_1_URI]
			),
			{
				contentPattern: PATTERN_INFO,
				folderQueries: [{ folder: ROOT_1_URI }],
				type: QueryType.Text
			});
	});

	test('simple exclude setting', () => {
		mockConfigService.setUserConfiguration('search', {
			...DEFAULT_USER_CONFIG,
			exclude: {
				'bar/**': true,
				'foo/**': {
					'when': '$(basename).ts'
				}
			}
		});

		assertEqualTextQueries(
			queryBuilder.text(
				PATTERN_INFO,
				[ROOT_1_URI]
			),
			{
				contentPattern: PATTERN_INFO,
				folderQueries: [{
					folder: ROOT_1_URI,
					excludePattern: {
						'bar/**': true,
						'foo/**': {
							'when': '$(basename).ts'
						}
					}
				}],
				type: QueryType.Text
			});
	});

	test('simple include', () => {
		assertEqualTextQueries(
			queryBuilder.text(
				PATTERN_INFO,
				[ROOT_1_URI],
				{ includePattern: './bar' }
			),
			{
				contentPattern: PATTERN_INFO,
				folderQueries: [{
					folder: ROOT_1_URI,
					includePattern: {
						'bar': true,
						'bar/**': true
					}
				}],
				type: QueryType.Text
			});

		assertEqualTextQueries(
			queryBuilder.text(
				PATTERN_INFO,
				[ROOT_1_URI],
				{ includePattern: '.\\bar' }
			),
			{
				contentPattern: PATTERN_INFO,
				folderQueries: [{
					folder: ROOT_1_URI,
					includePattern: {
						'bar': true,
						'bar/**': true
					}
				}],
				type: QueryType.Text
			});
	});

	test('exclude setting and searchPath', () => {
		mockConfigService.setUserConfiguration('search', {
			...DEFAULT_USER_CONFIG,
			exclude: {
				'foo/**/*.js': true,
				'bar/**': {
					'when': '$(basename).ts'
				}
			}
		});

		assertEqualTextQueries(
			queryBuilder.text(
				PATTERN_INFO,
				[ROOT_1_URI],
				{ includePattern: './foo' }
			),
			{
				contentPattern: PATTERN_INFO,
				folderQueries: [{
					folder: ROOT_1_URI,
					includePattern: {
						'foo': true,
						'foo/**': true
					},
					excludePattern: {
						'foo/**/*.js': true,
						'bar/**': {
							'when': '$(basename).ts'
						}
					}
				}],
				type: QueryType.Text
			});
	});

	test('multiroot exclude settings', () => {
		const ROOT_2 = fixPath('/project/root2');
		const ROOT_2_URI = getUri(ROOT_2);
		const ROOT_3 = fixPath('/project/root3');
		const ROOT_3_URI = getUri(ROOT_3);
		mockWorkspace.folders = toWorkspaceFolders([{ path: ROOT_1_URI.fsPath }, { path: ROOT_2_URI.fsPath }, { path: ROOT_3_URI.fsPath }]);
		mockWorkspace.configuration = uri.file(fixPath('/config'));

		mockConfigService.setUserConfiguration('search', {
			...DEFAULT_USER_CONFIG,
			exclude: { 'foo/**/*.js': true }
		}, ROOT_1_URI);

		mockConfigService.setUserConfiguration('search', {
			...DEFAULT_USER_CONFIG,
			exclude: { 'bar': true }
		}, ROOT_2_URI);

		// There are 3 roots, the first two have search.exclude settings, test that the correct basic query is returned
		assertEqualTextQueries(
			queryBuilder.text(
				PATTERN_INFO,
				[ROOT_1_URI, ROOT_2_URI, ROOT_3_URI]
			),
			{
				contentPattern: PATTERN_INFO,
				folderQueries: [
					{ folder: ROOT_1_URI, excludePattern: patternsToIExpression('foo/**/*.js') },
					{ folder: ROOT_2_URI, excludePattern: patternsToIExpression('bar') },
					{ folder: ROOT_3_URI }
				],
				type: QueryType.Text
			}
		);

		// Now test that it merges the root excludes when an 'include' is used
		assertEqualTextQueries(
			queryBuilder.text(
				PATTERN_INFO,
				[ROOT_1_URI, ROOT_2_URI, ROOT_3_URI],
				{ includePattern: './root2/src' }
			),
			{
				contentPattern: PATTERN_INFO,
				folderQueries: [
					{
						folder: ROOT_2_URI,
						includePattern: {
							'src': true,
							'src/**': true
						},
						excludePattern: {
							'bar': true
						},
					}
				],
				type: QueryType.Text
			}
		);
	});

	test('simple exclude input pattern', () => {
		assertEqualTextQueries(
			queryBuilder.text(
				PATTERN_INFO,
				[ROOT_1_URI],
				{ excludePattern: 'foo' }
			),
			{
				contentPattern: PATTERN_INFO,
				folderQueries: [{
					folder: ROOT_1_URI
				}],
				type: QueryType.Text,
				excludePattern: patternsToIExpression(...globalGlob('foo'))
			});
	});

	test('file pattern trimming', () => {
		const content = 'content';
		assertEqualQueries(
			queryBuilder.file(
				undefined,
				{ filePattern: ` ${content} ` }
			),
			{
				folderQueries: [],
				filePattern: content,
				type: QueryType.File
			});
	});

	test('exclude ./ syntax', () => {
		assertEqualTextQueries(
			queryBuilder.text(
				PATTERN_INFO,
				[ROOT_1_URI],
				{ excludePattern: './bar' }
			),
			{
				contentPattern: PATTERN_INFO,
				folderQueries: [{
					folder: ROOT_1_URI,
					excludePattern: patternsToIExpression('bar', 'bar/**'),
				}],
				type: QueryType.Text
			});

		assertEqualTextQueries(
			queryBuilder.text(
				PATTERN_INFO,
				[ROOT_1_URI],
				{ excludePattern: './bar/**/*.ts' }
			),
			{
				contentPattern: PATTERN_INFO,
				folderQueries: [{
					folder: ROOT_1_URI,
					excludePattern: patternsToIExpression('bar/**/*.ts', 'bar/**/*.ts/**'),
				}],
				type: QueryType.Text
			});

		assertEqualTextQueries(
			queryBuilder.text(
				PATTERN_INFO,
				[ROOT_1_URI],
				{ excludePattern: '.\\bar\\**\\*.ts' }
			),
			{
				contentPattern: PATTERN_INFO,
				folderQueries: [{
					folder: ROOT_1_URI,
					excludePattern: patternsToIExpression('bar/**/*.ts', 'bar/**/*.ts/**'),
				}],
				type: QueryType.Text
			});
	});

	test('extraFileResources', () => {
		assertEqualTextQueries(
			queryBuilder.text(
				PATTERN_INFO,
				[ROOT_1_URI],
				{ extraFileResources: [getUri('/foo/bar.js')] }
			),
			{
				contentPattern: PATTERN_INFO,
				folderQueries: [{
					folder: ROOT_1_URI
				}],
				extraFileResources: [getUri('/foo/bar.js')],
				type: QueryType.Text
			});

		assertEqualTextQueries(
			queryBuilder.text(
				PATTERN_INFO,
				[ROOT_1_URI],
				{
					extraFileResources: [getUri('/foo/bar.js')],
					excludePattern: '*.js'
				}
			),
			{
				contentPattern: PATTERN_INFO,
				folderQueries: [{
					folder: ROOT_1_URI
				}],
				excludePattern: patternsToIExpression(...globalGlob('*.js')),
				type: QueryType.Text
			});

		assertEqualTextQueries(
			queryBuilder.text(
				PATTERN_INFO,
				[ROOT_1_URI],
				{
					extraFileResources: [getUri('/foo/bar.js')],
					includePattern: '*.txt'
				}
			),
			{
				contentPattern: PATTERN_INFO,
				folderQueries: [{
					folder: ROOT_1_URI
				}],
				includePattern: patternsToIExpression(...globalGlob('*.txt')),
				type: QueryType.Text
			});
	});

	suite('parseSearchPaths', () => {
		test('simple includes', () => {
			function testSimpleIncludes(includePattern: string, expectedPatterns: string[]): void {
				assert.deepEqual(
					queryBuilder.parseSearchPaths(includePattern),
					{
						pattern: patternsToIExpression(...expectedPatterns)
					},
					includePattern);
			}

			[
				['a', ['**/a/**', '**/a']],
				['a/b', ['**/a/b', '**/a/b/**']],
				['a/b,  c', ['**/a/b', '**/c', '**/a/b/**', '**/c/**']],
				['a,.txt', ['**/a', '**/a/**', '**/*.txt', '**/*.txt/**']],
				['a,,,b', ['**/a', '**/a/**', '**/b', '**/b/**']],
				['**/a,b/**', ['**/a', '**/a/**', '**/b/**']]
			].forEach(([includePattern, expectedPatterns]) => testSimpleIncludes(<string>includePattern, <string[]>expectedPatterns));
		});

		function testIncludes(includePattern: string, expectedResult: ISearchPathsResult): void {
			assertEqualSearchPathResults(
				queryBuilder.parseSearchPaths(includePattern),
				expectedResult,
				includePattern);
		}

		function testIncludesDataItem([includePattern, expectedResult]: [string, ISearchPathsResult]): void {
			testIncludes(includePattern, expectedResult);
		}

		test('absolute includes', () => {
			const cases: [string, ISearchPathsResult][] = [
				[
					fixPath('/foo/bar'),
					{
						searchPaths: [{ searchPath: getUri('/foo/bar') }]
					}
				],
				[
					fixPath('/foo/bar') + ',' + 'a',
					{
						searchPaths: [{ searchPath: getUri('/foo/bar') }],
						pattern: patternsToIExpression(...globalGlob('a'))
					}
				],
				[
					fixPath('/foo/bar') + ',' + fixPath('/1/2'),
					{
						searchPaths: [{ searchPath: getUri('/foo/bar') }, { searchPath: getUri('/1/2') }]
					}
				],
				[
					fixPath('/foo/bar') + ',' + fixPath('/foo/../foo/bar/fooar/..'),
					{
						searchPaths: [{
							searchPath: getUri('/foo/bar')
						}]
					}
				],
				[
					fixPath('/foo/bar/**/*.ts'),
					{
						searchPaths: [{
							searchPath: getUri('/foo/bar'),
							pattern: patternsToIExpression('**/*.ts', '**/*.ts/**')
						}]
					}
				],
				[
					fixPath('/foo/bar/*a/b/c'),
					{
						searchPaths: [{
							searchPath: getUri('/foo/bar'),
							pattern: patternsToIExpression('*a/b/c', '*a/b/c/**')
						}]
					}
				],
				[
					fixPath('/*a/b/c'),
					{
						searchPaths: [{
							searchPath: getUri('/'),
							pattern: patternsToIExpression('*a/b/c', '*a/b/c/**')
						}]
					}
				],
				[
					fixPath('/foo/{b,c}ar'),
					{
						searchPaths: [{
							searchPath: getUri('/foo'),
							pattern: patternsToIExpression('{b,c}ar', '{b,c}ar/**')
						}]
					}
				]
			];
			cases.forEach(testIncludesDataItem);
		});

		test('includes with tilde', () => {
			const userHome = TestEnvironmentService.userHome;
			const cases: [string, ISearchPathsResult][] = [
				[
					'~/foo/bar',
					{
						searchPaths: [{ searchPath: getUri(userHome, '/foo/bar') }]
					}
				],
				[
					'~/foo/bar, a',
					{
						searchPaths: [{ searchPath: getUri(userHome, '/foo/bar') }],
						pattern: patternsToIExpression(...globalGlob('a'))
					}
				],
				[
					fixPath('/foo/~/bar'),
					{
						searchPaths: [{ searchPath: getUri('/foo/~/bar') }]
					}
				],
			];
			cases.forEach(testIncludesDataItem);
		});

		test('relative includes w/single root folder', () => {
			const cases: [string, ISearchPathsResult][] = [
				[
					'./a',
					{
						searchPaths: [{
							searchPath: ROOT_1_URI,
							pattern: patternsToIExpression('a', 'a/**')
						}]
					}
				],
				[
					'./a/',
					{
						searchPaths: [{
							searchPath: ROOT_1_URI,
							pattern: patternsToIExpression('a', 'a/**')
						}]
					}
				],
				[
					'./a/*b/c',
					{
						searchPaths: [{
							searchPath: ROOT_1_URI,
							pattern: patternsToIExpression('a/*b/c', 'a/*b/c/**')
						}]
					}
				],
				[
					'./a/*b/c, ' + fixPath('/project/foo'),
					{
						searchPaths: [
							{
								searchPath: ROOT_1_URI,
								pattern: patternsToIExpression('a/*b/c', 'a/*b/c/**')
							},
							{
								searchPath: getUri('/project/foo')
							}]
					}
				],
				[
					'./a/b/,./c/d',
					{
						searchPaths: [{
							searchPath: ROOT_1_URI,
							pattern: patternsToIExpression('a/b', 'a/b/**', 'c/d', 'c/d/**')
						}]
					}
				],
				// TODO @ rob
				// [
				// 	'../',
				// 	{
				// 		searchPaths: [{
				// 			searchPath: getUri('foo/')
				// 		}]
				// 	}
				// ]
			];
			cases.forEach(testIncludesDataItem);
		});

		test('relative includes w/two root folders', () => {
			const ROOT_2 = '/project/root2';
			mockWorkspace.folders = toWorkspaceFolders([{ path: ROOT_1_URI.fsPath }, { path: getUri(ROOT_2).fsPath }]);
			mockWorkspace.configuration = uri.file(fixPath('config'));

			const cases: [string, ISearchPathsResult][] = [
				[
					'./root1',
					{
						searchPaths: [{
							searchPath: getUri(ROOT_1)
						}]
					}
				],
				[
					'./root2',
					{
						searchPaths: [{
							searchPath: getUri(ROOT_2),
						}]
					}
				],
				[
					'./root1/a/**/b, ./root2/**/*.txt',
					{
						searchPaths: [
							{
								searchPath: ROOT_1_URI,
								pattern: patternsToIExpression('a/**/b', 'a/**/b/**')
							},
							{
								searchPath: getUri(ROOT_2),
								pattern: patternsToIExpression('**/*.txt', '**/*.txt/**')
							}]
					}
				]
			];
			cases.forEach(testIncludesDataItem);
		});

		test('include ./foldername', () => {
			const ROOT_2 = '/project/root2';
			const ROOT_1_FOLDERNAME = 'foldername';
			mockWorkspace.folders = toWorkspaceFolders([{ path: ROOT_1_URI.fsPath, name: ROOT_1_FOLDERNAME }, { path: getUri(ROOT_2).fsPath }]);
			mockWorkspace.configuration = uri.file(fixPath('config'));

			const cases: [string, ISearchPathsResult][] = [
				[
					'./foldername',
					{
						searchPaths: [{
							searchPath: ROOT_1_URI
						}]
					}
				],
				[
					'./foldername/foo',
					{
						searchPaths: [{
							searchPath: ROOT_1_URI,
							pattern: patternsToIExpression('foo', 'foo/**')
						}]
					}
				]
			];
			cases.forEach(testIncludesDataItem);
		});

		test('relative includes w/multiple ambiguous root folders', () => {
			const ROOT_2 = '/project/rootB';
			const ROOT_3 = '/otherproject/rootB';
			mockWorkspace.folders = toWorkspaceFolders([{ path: ROOT_1_URI.fsPath }, { path: getUri(ROOT_2).fsPath }, { path: getUri(ROOT_3).fsPath }]);
			mockWorkspace.configuration = uri.file(fixPath('/config'));

			const cases: [string, ISearchPathsResult][] = [
				[
					'',
					{
						searchPaths: undefined
					}
				],
				[
					'./',
					{
						searchPaths: undefined
					}
				],
				[
					'./root1',
					{
						searchPaths: [{
							searchPath: getUri(ROOT_1)
						}]
					}
				],
				[
					'./root1,./',
					{
						searchPaths: [{
							searchPath: getUri(ROOT_1)
						}]
					}
				],
				[
					'./rootB',
					{
						searchPaths: [
							{
								searchPath: getUri(ROOT_2),
							},
							{
								searchPath: getUri(ROOT_3),
							}]
					}
				],
				[
					'./rootB/a/**/b, ./rootB/b/**/*.txt',
					{
						searchPaths: [
							{
								searchPath: getUri(ROOT_2),
								pattern: patternsToIExpression('a/**/b', 'a/**/b/**', 'b/**/*.txt', 'b/**/*.txt/**')
							},
							{
								searchPath: getUri(ROOT_3),
								pattern: patternsToIExpression('a/**/b', 'a/**/b/**', 'b/**/*.txt', 'b/**/*.txt/**')
							}]
					}
				],
				[
					'./root1/**/foo/, bar/',
					{
						pattern: patternsToIExpression('**/bar', '**/bar/**'),
						searchPaths: [
							{
								searchPath: ROOT_1_URI,
								pattern: patternsToIExpression('**/foo', '**/foo/**')
							}]
					}
				]
			];
			cases.forEach(testIncludesDataItem);
		});
	});

	suite('smartCase', () => {
		test('no flags -> no change', () => {
			const query = queryBuilder.text(
				{
					pattern: 'a'
				},
				[]);

			assert(!query.contentPattern.isCaseSensitive);
		});

		test('maintains isCaseSensitive when smartCase not set', () => {
			const query = queryBuilder.text(
				{
					pattern: 'a',
					isCaseSensitive: true
				},
				[]);

			assert(query.contentPattern.isCaseSensitive);
		});

		test('maintains isCaseSensitive when smartCase set', () => {
			const query = queryBuilder.text(
				{
					pattern: 'a',
					isCaseSensitive: true
				},
				[],
				{
					isSmartCase: true
				});

			assert(query.contentPattern.isCaseSensitive);
		});

		test('smartCase determines not case sensitive', () => {
			const query = queryBuilder.text(
				{
					pattern: 'abcd'
				},
				[],
				{
					isSmartCase: true
				});

			assert(!query.contentPattern.isCaseSensitive);
		});

		test('smartCase determines case sensitive', () => {
			const query = queryBuilder.text(
				{
					pattern: 'abCd'
				},
				[],
				{
					isSmartCase: true
				});

			assert(query.contentPattern.isCaseSensitive);
		});

		test('smartCase determines not case sensitive (regex)', () => {
			const query = queryBuilder.text(
				{
					pattern: 'ab\\Sd',
					isRegExp: true
				},
				[],
				{
					isSmartCase: true
				});

			assert(!query.contentPattern.isCaseSensitive);
		});

		test('smartCase determines case sensitive (regex)', () => {
			const query = queryBuilder.text(
				{
					pattern: 'ab[A-Z]d',
					isRegExp: true
				},
				[],
				{
					isSmartCase: true
				});

			assert(query.contentPattern.isCaseSensitive);
		});
	});

	suite('file', () => {
		test('simple file query', () => {
			const cacheKey = 'asdf';
			const query = queryBuilder.file([ROOT_1_URI], {
				cacheKey,
				sortByScore: true
			});

			assert.equal(query.folderQueries.length, 1);
			assert.equal(query.cacheKey, cacheKey);
			assert(query.sortByScore);
		});
	});
});

function assertEqualTextQueries(actual: ITextQuery, expected: ITextQuery): void {
	expected = {
		...DEFAULT_TEXT_QUERY_PROPS,
		...expected
	};

	return assertEqualQueries(actual, expected);
}

function assertEqualQueries(actual: ITextQuery | IFileQuery, expected: ITextQuery | IFileQuery): void {
	expected = {
		...DEFAULT_QUERY_PROPS,
		...expected
	};

	const folderQueryToCompareObject = (fq: IFolderQuery) => {
		return {
			path: fq.folder.fsPath,
			excludePattern: normalizeExpression(fq.excludePattern),
			includePattern: normalizeExpression(fq.includePattern),
			fileEncoding: fq.fileEncoding
		};
	};

	// Avoid comparing URI objects, not a good idea
	if (expected.folderQueries) {
		assert.deepEqual(actual.folderQueries.map(folderQueryToCompareObject), expected.folderQueries.map(folderQueryToCompareObject));
		delete actual.folderQueries;
		delete expected.folderQueries;
	}

	if (expected.extraFileResources) {
		assert.deepEqual(actual.extraFileResources!.map(extraFile => extraFile.fsPath), expected.extraFileResources.map(extraFile => extraFile.fsPath));
		delete expected.extraFileResources;
		delete actual.extraFileResources;
	}

	delete actual.usingSearchPaths;
	actual.includePattern = normalizeExpression(actual.includePattern);
	actual.excludePattern = normalizeExpression(actual.excludePattern);
	cleanUndefinedQueryValues(actual);

	assert.deepEqual(actual, expected);
}

function assertEqualSearchPathResults(actual: ISearchPathsResult, expected: ISearchPathsResult, message?: string): void {
	cleanUndefinedQueryValues(actual);
	assert.deepEqual(actual.pattern, expected.pattern, message);

	assert.equal(actual.searchPaths && actual.searchPaths.length, expected.searchPaths && expected.searchPaths.length);
	if (actual.searchPaths) {
		actual.searchPaths.forEach((searchPath, i) => {
			const expectedSearchPath = expected.searchPaths![i];
			assert.deepEqual(searchPath.pattern, expectedSearchPath.pattern);
			assert.equal(searchPath.searchPath.toString(), expectedSearchPath.searchPath.toString());
		});
	}
}

/**
 * Recursively delete all undefined property values from the search query, to make it easier to
 * assert.deepEqual with some expected object.
 */
function cleanUndefinedQueryValues(q: any): void {
	for (const key in q) {
		if (q[key] === undefined) {
			delete q[key];
		} else if (typeof q[key] === 'object') {
			cleanUndefinedQueryValues(q[key]);
		}
	}

	return q;
}

function globalGlob(pattern: string): string[] {
	return [
		`**/${pattern}/**`,
		`**/${pattern}`
	];
}

function patternsToIExpression(...patterns: string[]): IExpression {
	return patterns.length ?
		patterns.reduce((glob, cur) => { glob[cur] = true; return glob; }, Object.create(null)) :
		undefined;
}

function getUri(...slashPathParts: string[]): uri {
	return uri.file(fixPath(...slashPathParts));
}

function fixPath(...slashPathParts: string[]): string {
	if (process.platform === 'win32' && slashPathParts.length && !slashPathParts[0].match(/^c:/i)) {
		slashPathParts.unshift('c:');
	}

	return paths.join(...slashPathParts);
}

function normalizeExpression(expression: IExpression | undefined): IExpression | undefined {
	if (!expression) {
		return expression;
	}

	const normalized = Object.create(null);
	Object.keys(expression).forEach(key => {
		normalized[key.replace(/\\/g, '/')] = expression[key];
	});

	return normalized;
}
