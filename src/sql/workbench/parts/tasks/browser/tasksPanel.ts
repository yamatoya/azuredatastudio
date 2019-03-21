/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/tasks';

import { Panel } from 'vs/workbench/browser/panel';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { localize } from 'vs/nls';
import { WorkbenchObjectTree } from 'vs/platform/list/browser/listService';
import { TreeElement, FilterData, VirtualDelegate, StepRenderer, TaskRenderer } from 'sql/workbench/parts/tasks/browser/tasksTreeViewer';
import * as dom from 'vs/base/browser/dom';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export const TASKS_PANEL_ID = 'workbench.panel.tasks';
export const TASKS_PANEL_TITLE = localize('tasks.panel.title', "Tasks");

export class TasksPanel extends Panel {

	private tree: WorkbenchObjectTree<TreeElement>;

	private treeContainer: HTMLElement;
	private messageBoxContainer: HTMLElement;
	private ariaLabelElement: HTMLElement;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private instantiationService: IInstantiationService
	) {
		super(TASKS_PANEL_ID, telemetryService, themeService, storageService);
	}

	public create(parent: HTMLElement): void {
		super.create(parent);

		dom.addClass(parent, 'tasks-panel');

		const container = dom.append(parent, dom.$('.tasks-panel-container'));

		this.createArialLabelElement(container);
		this.createMessageBox(container);
		this.createTree(container);
	}

	public layout(dimension: dom.Dimension): void {
		this.tree.layout(dimension.height, dimension.width);
	}

	private createTree(parent: HTMLElement): void {
		this.treeContainer = dom.append(parent, dom.$('.tree-container.show-file-icons'));

		const virtualDelegate = new VirtualDelegate();

		const renderers = [
			this.instantiationService.createInstance(StepRenderer),
			this.instantiationService.createInstance(TaskRenderer)
		];

		this.tree = this.instantiationService.createInstance(WorkbenchObjectTree,
			this.treeContainer,
			virtualDelegate,
			renderers,
			{}
		) as any as WorkbenchObjectTree<TreeElement>;
	}

	private createMessageBox(parent: HTMLElement): void {
		this.messageBoxContainer = dom.append(parent, dom.$('.message-box-container'));
		this.messageBoxContainer.setAttribute('aria-labelledby', 'tasks-panel-arialabel');
	}

	private createArialLabelElement(parent: HTMLElement): void {
		this.ariaLabelElement = dom.append(parent, dom.$(''));
		this.ariaLabelElement.setAttribute('id', 'tasks-panel-arialabel');
		this.ariaLabelElement.setAttribute('aria-live', 'polite');
	}
}
