/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PanelRegistry, Extensions as PanelExtensions, PanelDescriptor } from 'vs/workbench/browser/panel';
import { Registry } from 'vs/platform/registry/common/platform';
import { TasksPanel, TASKS_PANEL_ID, TASKS_PANEL_TITLE } from 'sql/workbench/parts/tasks/browser/tasksPanel';

// markers panel
Registry.as<PanelRegistry>(PanelExtensions.Panels).registerPanel(new PanelDescriptor(
	TasksPanel,
	TASKS_PANEL_ID,
	TASKS_PANEL_TITLE,
	'tasksPanel'
));
