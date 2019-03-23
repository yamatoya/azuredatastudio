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
import { KeyCode } from 'vs/base/common/keyCodes';
import Messages from 'sql/workbench/parts/tasks/common/messages';
import Constants from 'sql/workbench/parts/tasks/common/constants';
import { ITaskService2 } from 'sql/platform/tasks/common/tasksService2';
import { Iterator } from 'vs/base/common/iterator';
import { ITreeElement } from 'vs/base/browser/ui/tree/tree';
import { Task, Step } from 'sql/workbench/parts/tasks/common/tasksModel';
import { Event } from 'vs/base/common/event';

function createModelIterator(model: Array<Task>): Iterator<ITreeElement<TreeElement>> {
	const tasksIt = Iterator.fromArray(model);

	return Iterator.map(tasksIt, m => {
		const stepsIt = Iterator.fromArray(m.steps);

		const children = Iterator.map(stepsIt, m => {
			return { element: m };
		});

		return { element: m, children };
	});
}

export class TasksPanel extends Panel {

	private tree: WorkbenchObjectTree<TreeElement>;

	private treeContainer: HTMLElement;
	private messageBoxContainer: HTMLElement;
	private ariaLabelElement: HTMLElement;

	private cachedFilterStats: { total: number; filtered: number; } | undefined = undefined;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@ITaskService2 private taskService: ITaskService2
	) {
		super(Constants.TASKS_PANEL_ID, telemetryService, themeService, storageService);
	}

	public create(parent: HTMLElement): void {
		super.create(parent);

		dom.addClass(parent, 'tasks-panel');

		const container = dom.append(parent, dom.$('.tasks-panel-container'));

		this.createArialLabelElement(container);
		this.createMessageBox(container);
		this.createTree(container);
		this.createListeners();

		this.render();
	}

	public layout(dimension: dom.Dimension): void {
		this.tree.layout(dimension.height, dimension.width);
	}

	private refreshPanel(target?: Task | Step): void {
		if (this.isVisible()) {
			this.cachedFilterStats = undefined;

			if (target) {
				this.tree.rerender(target);
			} else {
				this.tree.setChildren(null, createModelIterator(this.taskService.tasks));
			}

			const { total, filtered } = this.getFilterStats();
			dom.toggleClass(this.treeContainer, 'hidden', total === 0 || filtered === 0);
			this.renderMessage();
			// this._onDidFilter.fire();
		}
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

	private createListeners(): void {
		this._register(Event.any(this.taskService.onNewTask, this.taskService.onNewStep)(e => this.refreshPanel()));
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

	private render(): void {
		this.cachedFilterStats = undefined;
		this.tree.setChildren(null, createModelIterator(this.taskService.tasks));
		const { total, filtered } = this.getFilterStats();
		dom.toggleClass(this.treeContainer, 'hidden', total === 0 || filtered === 0);
		this.renderMessage();
	}

	private renderMessage(): void {
		dom.clearNode(this.messageBoxContainer);
		const { total, filtered } = this.getFilterStats();

		if (filtered === 0) {
			this.messageBoxContainer.style.display = 'block';
			this.messageBoxContainer.setAttribute('tabIndex', '0');
			if (total > 0) {
				// if (this.filter.options.filter) {
				// 	this.renderFilteredByFilterMessage(this.messageBoxContainer);
				// } else {
				// 	this.renderFilteredByFilesExcludeMessage(this.messageBoxContainer);
				// }
			} else {
				this.renderNoProblemsMessage(this.messageBoxContainer);
			}
		} else {
			this.messageBoxContainer.style.display = 'none';
			if (filtered === total) {
				this.ariaLabelElement.setAttribute('aria-label', localize('No problems filtered', "Showing {0} problems", total));
			} else {
				this.ariaLabelElement.setAttribute('aria-label', localize('problems filtered', "Showing {0} of {1} problems", filtered, total));
			}
			this.messageBoxContainer.removeAttribute('tabIndex');
		}
	}

	/*
	private renderFilteredByFilesExcludeMessage(container: HTMLElement) {
		const span1 = dom.append(container, dom.$('span'));
		span1.textContent = Messages.MARKERS_PANEL_NO_PROBLEMS_FILE_EXCLUSIONS_FILTER;
		const link = dom.append(container, dom.$('a.messageAction'));
		link.textContent = localize('disableFilesExclude', "Disable Files Exclude Filter.");
		link.setAttribute('tabIndex', '0');
		dom.addStandardDisposableListener(link, dom.EventType.CLICK, () => this.filterAction.useFilesExclude = false);
		dom.addStandardDisposableListener(link, dom.EventType.KEY_DOWN, (e: IKeyboardEvent) => {
			if (e.equals(KeyCode.Enter) || e.equals(KeyCode.Space)) {
				this.filterAction.useFilesExclude = false;
				e.stopPropagation();
			}
		});
		this.ariaLabelElement.setAttribute('aria-label', Messages.MARKERS_PANEL_NO_PROBLEMS_FILE_EXCLUSIONS_FILTER);
	}

	private renderFilteredByFilterMessage(container: HTMLElement) {
		const span1 = dom.append(container, dom.$('span'));
		span1.textContent = Messages.MARKERS_PANEL_NO_PROBLEMS_FILTERS;
		const link = dom.append(container, dom.$('a.messageAction'));
		link.textContent = localize('clearFilter', "Clear Filter.");
		link.setAttribute('tabIndex', '0');
		dom.addStandardDisposableListener(link, dom.EventType.CLICK, () => this.filterAction.filterText = '');
		dom.addStandardDisposableListener(link, dom.EventType.KEY_DOWN, (e: IKeyboardEvent) => {
			if (e.equals(KeyCode.Enter) || e.equals(KeyCode.Space)) {
				this.filterAction.filterText = '';
				e.stopPropagation();
			}
		});
		this.ariaLabelElement.setAttribute('aria-label', Messages.MARKERS_PANEL_NO_PROBLEMS_FILTERS);
	}
	*/

	private renderNoProblemsMessage(container: HTMLElement) {
		const span = dom.append(container, dom.$('span'));
		span.textContent = Messages.TASKS_PANEL_NO_PROBLEMS_BUILT;
		this.ariaLabelElement.setAttribute('aria-label', Messages.TASKS_PANEL_NO_PROBLEMS_BUILT);
	}

	getFilterStats(): { total: number; filtered: number; } {
		if (!this.cachedFilterStats) {
			this.cachedFilterStats = this.computeFilterStats();
		}

		return this.cachedFilterStats;
	}

	private computeFilterStats(): { total: number; filtered: number; } {
		const root = this.tree.getNode();
		let total = 0;
		let filtered = 0;

		for (const taskNode of root.children) {
			total++;
			filtered++;
			for (const stepNode of taskNode.children) {
				total++;

				if (taskNode.visible && stepNode.visible) {
					filtered++;
				}
			}
		}

		return { total, filtered };
	}
}
