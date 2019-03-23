/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ITaskService } from 'sql/platform/taskHistory/common/taskService';
import { MainThreadBackgroundTaskManagementShape, SqlMainContext, ExtHostBackgroundTaskManagementShape, SqlExtHostContext } from 'sql/workbench/api/node/sqlExtHost.protocol';

import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { Disposable } from 'vs/base/common/lifecycle';
import { Task, Step } from 'sql/workbench/parts/tasks/common/tasksModel';


import * as azdata from 'azdata';
import { ITaskService2 } from 'sql/platform/tasks/common/tasksService2';

export enum TaskStatus {
	NotStarted = 0,
	InProgress = 1,
	Succeeded = 2,
	SucceededWithWarning = 3,
	Failed = 4,
	Canceled = 5,
	Canceling = 6
}

@extHostNamedCustomer(SqlMainContext.MainThreadBackgroundTaskManagement)
export class MainThreadBackgroundTaskManagement extends Disposable implements MainThreadBackgroundTaskManagementShape {
	private readonly _proxy: ExtHostBackgroundTaskManagementShape;

	constructor(
		context: IExtHostContext,
		@ITaskService private _taskService: ITaskService,
		@ITaskService2 private _taskService2: ITaskService2
	) {
		super();
		this._proxy = context.getProxy(SqlExtHostContext.ExtHostBackgroundTaskManagement);
		this._register(this._taskService.onTaskComplete(task => {
			if (task.status === TaskStatus.Canceling) {
				this._proxy.$onTaskCanceled(task.id);
			}
		}));
	}

	$registerTask(taskInfo: azdata.TaskInfo): void {
		this._taskService.createNewTask(taskInfo);
		this._proxy.$onTaskRegistered(taskInfo.taskId);
	}

	$updateTask(taskProgressInfo: azdata.TaskProgressInfo): void {
		this._taskService.updateTask(taskProgressInfo);
	}

	$registerNewTask(id: string, name: string, description?: string): void {
		this._taskService2.registerTask(new Task(name, description, id));
	}

	$registerTaskStep(parentId: string, stepId: string, name: string, description?: string): void {
		this._taskService2.addStep(parentId, new Step(name, description, stepId));
	}
}
