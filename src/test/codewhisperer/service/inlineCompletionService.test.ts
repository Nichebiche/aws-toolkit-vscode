/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode'
import assert from 'assert'
import * as sinon from 'sinon'
import { InlineCompletionService } from '../../../codewhisperer/service/inlineCompletionService'
import { createMockTextEditor, resetCodeWhispererGlobalVariables, createMockDocument } from '../testUtil'
import { ReferenceInlineProvider } from '../../../codewhisperer/service/referenceInlineProvider'
import { RecommendationHandler } from '../../../codewhisperer/service/recommendationHandler'
import * as codewhispererSdkClient from '../../../codewhisperer/client/codewhisperer'
import { ConfigurationEntry } from '../../../codewhisperer/models/model'
import { CWInlineCompletionItemProvider } from '../../../codewhisperer/service/inlineCompletionItemProvider'
import { session } from '../../../codewhisperer/util/codeWhispererSession'

describe('inlineCompletionService', function () {
    beforeEach(function () {
        resetCodeWhispererGlobalVariables()
    })

    describe('getPaginatedRecommendation', function () {
        const config: ConfigurationEntry = {
            isShowMethodsEnabled: true,
            isManualTriggerEnabled: true,
            isAutomatedTriggerEnabled: true,
            isSuggestionsWithCodeReferencesEnabled: true,
        }

        let mockClient: codewhispererSdkClient.DefaultCodeWhispererClient

        beforeEach(function () {
            mockClient = new codewhispererSdkClient.DefaultCodeWhispererClient()
            resetCodeWhispererGlobalVariables()
        })

        afterEach(function () {
            sinon.restore()
        })

        it('should call checkAndResetCancellationTokens before showing inline and next token to be null', async function () {
            const mockEditor = createMockTextEditor()
            sinon.stub(RecommendationHandler.instance, 'getRecommendations').resolves({
                result: 'Succeeded',
                errorMessage: undefined,
            })
            const checkAndResetCancellationTokensStub = sinon.stub(
                RecommendationHandler.instance,
                'checkAndResetCancellationTokens'
            )
            session.recommendations = [{ content: "\n\t\tconsole.log('Hello world!');\n\t}" }, { content: '' }]
            await InlineCompletionService.instance.getPaginatedRecommendation(
                mockClient,
                mockEditor,
                'OnDemand',
                config
            )
            assert.ok(checkAndResetCancellationTokensStub.called)
            assert.strictEqual(RecommendationHandler.instance.hasNextToken(), false)
        })
    })

    describe('clearInlineCompletionStates', function () {
        it('should remove inline reference and recommendations', async function () {
            const fakeReferences = [
                {
                    message: '',
                    licenseName: 'MIT',
                    repository: 'http://github.com/fake',
                    recommendationContentSpan: {
                        start: 0,
                        end: 10,
                    },
                },
            ]
            ReferenceInlineProvider.instance.setInlineReference(1, 'test', fakeReferences)
            session.recommendations = [{ content: "\n\t\tconsole.log('Hello world!');\n\t}" }, { content: '' }]
            session.language = 'python'

            assert.ok(session.recommendations.length > 0)
            await RecommendationHandler.instance.clearInlineCompletionStates()
            assert.strictEqual(ReferenceInlineProvider.instance.refs.length, 0)
            assert.strictEqual(session.recommendations.length, 0)
        })
    })

    describe('truncateOverlapWithRightContext', function () {
        const fileName = 'test.py'
        const language = 'python'
        const rightContext = 'return target\n'
        const doc = `import math\ndef two_sum(nums, target):\n`
        const provider = new CWInlineCompletionItemProvider(0, 0, [], '', new vscode.Position(0, 0), '')

        it('removes overlap with right context from suggestion', async function () {
            const mockSuggestion = 'return target\n'
            const mockEditor = createMockTextEditor(`${doc}${rightContext}`, fileName, language)
            const cursorPosition = new vscode.Position(2, 0)
            const result = provider.truncateOverlapWithRightContext(mockEditor.document, mockSuggestion, cursorPosition)
            assert.strictEqual(result, '')
        })

        it('only removes the overlap part from suggestion', async function () {
            const mockSuggestion = 'print(nums)\nreturn target\n'
            const mockEditor = createMockTextEditor(`${doc}${rightContext}`, fileName, language)
            const cursorPosition = new vscode.Position(2, 0)
            const result = provider.truncateOverlapWithRightContext(mockEditor.document, mockSuggestion, cursorPosition)
            assert.strictEqual(result, 'print(nums)\n')
        })

        it('only removes the last overlap pattern from suggestion', async function () {
            const mockSuggestion = 'return target\nprint(nums)\nreturn target\n'
            const mockEditor = createMockTextEditor(`${doc}${rightContext}`, fileName, language)
            const cursorPosition = new vscode.Position(2, 0)
            const result = provider.truncateOverlapWithRightContext(mockEditor.document, mockSuggestion, cursorPosition)
            assert.strictEqual(result, 'return target\nprint(nums)\n')
        })

        it('returns empty string if the remaining suggestion only contains white space', async function () {
            const mockSuggestion = 'return target\n     '
            const mockEditor = createMockTextEditor(`${doc}${rightContext}`, fileName, language)
            const cursorPosition = new vscode.Position(2, 0)
            const result = provider.truncateOverlapWithRightContext(mockEditor.document, mockSuggestion, cursorPosition)
            assert.strictEqual(result, '')
        })

        it('returns the original suggestion if no match found', async function () {
            const mockSuggestion = 'import numpy\n'
            const mockEditor = createMockTextEditor(`${doc}${rightContext}`, fileName, language)
            const cursorPosition = new vscode.Position(2, 0)
            const result = provider.truncateOverlapWithRightContext(mockEditor.document, mockSuggestion, cursorPosition)
            assert.strictEqual(result, 'import numpy\n')
        })

        it('ignores the space at the end of recommendation', async function () {
            const mockSuggestion = 'return target\n\n\n\n\n'
            const mockEditor = createMockTextEditor(`${doc}${rightContext}`, fileName, language)
            const cursorPosition = new vscode.Position(2, 0)
            const result = provider.truncateOverlapWithRightContext(mockEditor.document, mockSuggestion, cursorPosition)
            assert.strictEqual(result, '')
        })

        it('ignores the space at the start of right context', async function () {
            const testRightContext = '\n\n\n\nreturn target'
            const mockEditor = createMockTextEditor(`${doc}${testRightContext}`, fileName, language)
            const mockSuggestion = 'return target\n'
            const cursorPosition = new vscode.Position(2, 0)
            const result = provider.truncateOverlapWithRightContext(mockEditor.document, mockSuggestion, cursorPosition)
            assert.strictEqual(result, '')
        })
    })
})

describe('CWInlineCompletionProvider', function () {
    beforeEach(function () {
        resetCodeWhispererGlobalVariables()
    })

    describe('provideInlineCompletionItems', function () {
        beforeEach(function () {
            resetCodeWhispererGlobalVariables()
        })

        afterEach(function () {
            sinon.restore()
        })

        it('should return undefined if position is before RecommendationHandler start pos', async function () {
            const position = new vscode.Position(0, 0)
            const document = createMockDocument()
            const fakeContext = { triggerKind: 0, selectedCompletionInfo: undefined }
            const token = new vscode.CancellationTokenSource().token
            const provider = new CWInlineCompletionItemProvider(0, 0, [], '', new vscode.Position(1, 1), '')
            const result = await provider.provideInlineCompletionItems(document, position, fakeContext, token)

            assert.ok(result === undefined)
        })
    })
})
