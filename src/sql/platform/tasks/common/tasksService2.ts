/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Task } from 'sql/workbench/parts/tasks/common/tasksModel';
import { Event, Emitter } from 'vs/base/common/event';

export const ITaskService2 = createDecorator<ITaskService2>('taskService2');

export interface ITaskService2 {
	_serviceBrand: any;
	readonly onNewTask: Event<Task>;
	registerTask(task: Task);
	readonly tasks: Array<Task>;
}

export class TaskService2 implements ITaskService2 {
	_serviceBrand: any;

	private _onNewTask = new Emitter<Task>();
	public readonly onNewTask = this._onNewTask.event;

	private _tasks: Array<Task> = new Array<Task>();

	registerTask(task: Task) {
		this._onNewTask.fire(task);
	}

	public get tasks(): Array<Task> {
		return this._tasks;
	}
}
