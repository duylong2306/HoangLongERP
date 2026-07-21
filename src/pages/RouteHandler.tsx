/**
 * Main content router — maps activeTab to the correct page component.
 * Extracted from App.tsx to reduce its size by ~400 lines.
 */
import React from 'react';
import DashboardOverview from '../components/DashboardOverview';
import ProjectManagement from '../components/ProjectManagement';
import ProjectKanbanBoard from '../components/ProjectKanbanBoard';
import TaskManagement from '../components/TaskManagement';
import QuotationSystem from '../components/QuotationSystem';
import FinanceManagement from '../components/FinanceManagement';
import MaterialCoordination from '../components/MaterialCoordination';
import WarehouseSuppliers from '../components/WarehouseSuppliers';
import WarehouseManagement from '../components/WarehouseManagement';
import HumanResourcesManagement from '../components/HumanResourcesManagement';
import SubcontractorManagement from '../components/SubcontractorManagement';
import { Employee, Customer, Project, Task, Receipt, Payment, Quote } from '../types';
import { isUserInRoleGroup } from '../context';

interface Props {
  activeTab: string;
  projects: Project[]; tasks: Task[]; receipts: Receipt[]; payments: Payment[]; quotes: Quote[];
  customers: Customer[]; employees: Employee[]; currentUser: Employee | null;
  onAddProject: (p: Project) => void; onDeleteProject: (id: string) => void;
  onUpdateProjectStatus: (id: string, s: any, p: number) => void;
  onUpdateProject: (id: string, u: Partial<Project>) => void;
  onUpdateMultipleProjects: (l: Project[]) => Promise<void>;
  onAddTask: (t: Task) => void; onDeleteTask: (id: string) => void;
  onDeleteMultipleTasks: (ids: string[]) => void;
  onUpdateTask: (id: string, u: Partial<Task>) => void;
  onAddQuote: (q: Quote) => void; onUpdateQuoteStatus: (id: string, s: any) => void;
  onAddReceipt: (r: Receipt) => void; onAddPayment: (p: Payment) => void;
  onApprovePayment: (id: string, s: 'approved' | 'rejected') => void;
  onAddCustomer: (c: Customer) => void; onDeleteCustomer: (id: string) => void;
  onNavigateTab: (tab: string) => void;
  onRedirectToQuote: (projectId: string) => void;
  onRedirectToSubcontractor: (projectId: string, subId: string, wn: string) => void;
  accentTextClass: string;
  preselectedCustomerId: string; preselectedProjectId: string;
  financeSubTab: string; financeDuLieuTab: string; hrSubTab: string;
}

export default function RouteHandler(p: Props) {
  const { activeTab } = p;
  const t = (tab: string) => p.activeTab === tab;

  // Shared Kanban props
  const kanbanProps = (sector: string) => ({
    sector: sector as any,
    projects: p.projects, customers: p.customers, employees: p.employees,
    tasks: p.tasks, receipts: p.receipts, payments: p.payments,
    onAddProject: p.onAddProject, onUpdateProject: p.onUpdateProject,
    onDeleteProject: p.onDeleteProject, onAddTask: p.onAddTask,
    onUpdateTask: p.onUpdateTask, onDeleteTask: p.onDeleteTask,
    onDeleteMultipleTasks: p.onDeleteMultipleTasks,
    onAddCustomer: p.onAddCustomer, currentUser: p.currentUser,
    quotes: p.quotes, onRedirectToQuote: p.onRedirectToQuote,
    onRedirectToSubcontractor: p.onRedirectToSubcontractor,
  });

  if (t('dashboard')) return <DashboardOverview projects={p.projects} tasks={p.tasks} receipts={p.receipts} payments={p.payments} quotes={p.quotes} currentUser={p.currentUser} onNavigateTab={p.onNavigateTab} onUpdateTask={p.onUpdateTask} onApprovePayment={p.onApprovePayment} onAddTask={p.onAddTask} onAddPayment={p.onAddPayment} />;
  if (t('projects')) return <ProjectManagement projects={p.projects} customers={p.customers} employees={p.employees} receipts={p.receipts} payments={p.payments} onAddProject={p.onAddProject} onUpdateProjectStatus={p.onUpdateProjectStatus} onUpdateProject={p.onUpdateProject} onDeleteProject={p.onDeleteProject} onAddCustomer={p.onAddCustomer} currentUser={p.currentUser} />;
  if (t('projects-construction')) return <ProjectKanbanBoard {...kanbanProps('construction')} />;
  if (t('projects-furniture')) return <ProjectKanbanBoard {...kanbanProps('furniture')} />;
  if (t('projects-mechanical')) return <ProjectKanbanBoard {...kanbanProps('mechanical')} />;
  if (t('tasks')) return <TaskManagement tasks={p.tasks} projects={p.projects} employees={p.employees} currentUser={p.currentUser} customers={p.customers} quotes={p.quotes} onAddTask={p.onAddTask} onUpdateTask={p.onUpdateTask} onUpdateProject={p.onUpdateProject} onDeleteTask={p.onDeleteTask} onDeleteMultipleTasks={p.onDeleteMultipleTasks} onRedirectToQuote={p.onRedirectToQuote} onRedirectToSubcontractor={p.onRedirectToSubcontractor} />;
  if (['quotes', 'quotes-construction', 'quotes-mechanical', 'quotes-subcontractor'].includes(activeTab)) return <QuotationSystem quotes={p.quotes} customers={p.customers} projects={p.projects} onAddQuote={p.onAddQuote} onUpdateQuoteStatus={p.onUpdateQuoteStatus} preselectedCustomerId={p.preselectedCustomerId} preselectedProjectId={p.preselectedProjectId} currentUser={p.currentUser ?? undefined} initialTab={activeTab === 'quotes-construction' ? 'construction' : activeTab === 'quotes-mechanical' ? 'mechanical' : activeTab === 'quotes-subcontractor' ? 'subcontractor' : 'furniture'} />;
  if (t('subcontractor-management')) return <SubcontractorManagement currentUser={p.currentUser!} canEdit={p.currentUser ? (isUserInRoleGroup(p.currentUser.id, 'role_admin') || isUserInRoleGroup(p.currentUser.id, 'role_office')) : false} canDelete={p.currentUser ? isUserInRoleGroup(p.currentUser.id, 'role_admin') : false} />;
  if (t('finance')) return <FinanceManagement receipts={p.receipts} payments={p.payments} projects={p.projects} customers={p.customers} currentUser={p.currentUser} onAddReceipt={p.onAddReceipt} onAddPayment={p.onAddPayment} onApprovePayment={p.onApprovePayment} onAddCustomer={p.onAddCustomer} onDeleteCustomer={p.onDeleteCustomer} initialSubTab={p.financeSubTab} initialDuLieuTab={p.financeDuLieuTab} />;
  if (t('material-coordination')) return <MaterialCoordination projects={p.projects} employees={p.employees} onUpdateProject={p.onUpdateProject} onUpdateMultipleProjects={p.onUpdateMultipleProjects} currentUser={p.currentUser} customers={p.customers} />;
  if (t('warehouse-suppliers')) return <WarehouseSuppliers />;
  if (t('warehouse-management')) return <WarehouseManagement />;
  if (t('employees')) return <HumanResourcesManagement currentUser={p.currentUser!} projects={p.projects} customers={p.customers} defaultSubTab={p.hrSubTab} />;
  return null;
}
