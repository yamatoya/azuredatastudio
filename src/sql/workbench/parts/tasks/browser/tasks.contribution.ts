/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PanelRegistry, Extensions as PanelExtensions, PanelDescriptor } from 'vs/workbench/browser/panel';
import { Registry } from 'vs/platform/registry/common/platform';
import { TasksPanel } from 'sql/workbench/parts/tasks/browser/tasksPanel';
import Messages from 'sql/workbench/parts/tasks/common/messages';
import Constants from 'sql/workbench/parts/tasks/common/constants';

// markers panel
Registry.as<PanelRegistry>(PanelExtensions.Panels).registerPanel(new PanelDescriptor(
	TasksPanel,
	Constants.TASKS_PANEL_ID,
	Messages.MARKERS_PANEL_TITLE_PROBLEMS,
	'tasksPanel'
));
