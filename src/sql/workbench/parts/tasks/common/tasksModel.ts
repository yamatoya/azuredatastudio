/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { generateUuid } from 'vs/base/common/uuid';

export class Task {
	private _id: string;
	private _name: string;
	private _description: string;

	constructor(name: string, description?: string, id?: string) {
		this._id = id || generateUuid();
		this._name = name;
		this._description = description || '';
	}

}

export class Step {

}
