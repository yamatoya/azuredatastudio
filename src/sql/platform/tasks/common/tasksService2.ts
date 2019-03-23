/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Task, Step } from 'sql/workbench/parts/tasks/common/tasksModel';
import { Event, Emitter } from 'vs/base/common/event';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { values } from 'vs/base/common/map';

export const ITaskService2 = createDecorator<ITaskService2>('taskService2');

export interface ITaskService2 {
	_serviceBrand: any;
	readonly onNewTask: Event<Task>;
	readonly onNewStep: Event<Task>;
	registerTask(task: Task): void;
	addStep(parentId: string, step: Step): void;
	readonly tasks: Array<Task>;
}

export class TaskService2 implements ITaskService2 {
	_serviceBrand: any;

	private _onNewTask = new Emitter<Task>();
	public readonly onNewTask = this._onNewTask.event;

	private _onNewStep = new Emitter<Task>();
	public readonly onNewStep = this._onNewStep.event;

	private _tasks = new Map<string, Task>();

	registerTask(task: Task): void {
		this._tasks.set(task.id, task);
		this._onNewTask.fire(task);
	}

	addStep(parentId: string, step: Step): void {
		const task = this._tasks.get(parentId);
		task.steps.push(step);
		this._onNewStep.fire(task);
	}

	get tasks(): Array<Task> {
		return values(this._tasks);
	}
}

registerSingleton(ITaskService2, TaskService2);
