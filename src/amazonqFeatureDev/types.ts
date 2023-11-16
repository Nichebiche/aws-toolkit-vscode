/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import * as vscode from 'vscode'
import { VirtualFileSystem } from '../shared/virtualFilesystem'
import type { CancellationTokenSource } from 'vscode'
import { Messenger } from './controllers/chat/messenger/messenger'
import { FeatureDevClient } from './client/featureDev'
import { featureDevScheme } from './constants'

export type Interaction = {
    // content to be sent back to the chat UI
    content?: string
}

export interface SessionStateInteraction {
    nextState: SessionState | Omit<SessionState, 'uploadId'> | undefined
    interaction: Interaction
}

export enum FollowUpTypes {
    WriteCode = 'WriteCode',
    AcceptCode = 'AcceptCode',
    ProvideFeedbackAndRegenerateCode = 'ProvideFeedbackAndRegenerateCode',
    Retry = 'Retry',
    ModifyDefaultSourceFolder = 'ModifyDefaultSourceFolder',
}

export type SessionStatePhase = 'Init' | 'Approach' | 'Codegen'

export interface SessionState {
    readonly filePaths?: string[]
    readonly deletedFiles?: string[]
    readonly phase?: SessionStatePhase
    readonly uploadId: string
    approach: string
    readonly tokenSource: CancellationTokenSource
    readonly tabID: string
    interact(action: SessionStateAction): Promise<SessionStateInteraction>
}

export interface SessionStateConfig {
    sourceRoot: string
    workspaceRoot: string
    conversationId: string
    proxyClient: FeatureDevClient
    uploadId: string
}

export interface SessionStateAction {
    task: string
    files: any[] // TODO: remove any
    msg?: string
    messenger: Messenger
    fs: VirtualFileSystem
}

export type NewFileContents = { filePath: string; fileContent: string }[]

export interface SessionInfo {
    // TODO, if it had a summarized name that was better for the UI
    name?: string
    history: string[]
}

export interface SessionStorage {
    [key: string]: SessionInfo
}

export function createUri(filePath: string, tabID?: string) {
    return vscode.Uri.from({
        scheme: featureDevScheme,
        path: filePath,
        ...(tabID ? { query: `tabID=${tabID}` } : {}),
    })
}
