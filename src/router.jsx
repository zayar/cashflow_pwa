import React, { Suspense, lazy } from 'react';
import { useRoutes, Navigate } from 'react-router-dom';
import RouteFallback from './components/RouteFallback';

const RootLayout = lazy(() => import('./layout/RootLayout'));
const Welcome = lazy(() => import('./pages/Welcome'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Items = lazy(() => import('./pages/Items'));
const Clients = lazy(() => import('./pages/Clients'));
const More = lazy(() => import('./pages/More'));
const Login = lazy(() => import('./pages/Login'));
const InvoiceForm = lazy(() => import('./pages/InvoiceForm'));
const InvoiceView = lazy(() => import('./pages/InvoiceView'));
const InvoiceEdit = lazy(() => import('./pages/InvoiceEdit'));
const ItemForm = lazy(() => import('./pages/ItemForm'));
const ClientForm = lazy(() => import('./pages/ClientForm'));
const ClientView = lazy(() => import('./pages/ClientView'));
const ItemView = lazy(() => import('./pages/ItemView'));
const CustomerPickerPage = lazy(() => import('./pages/CustomerPicker'));
const ItemPickerPage = lazy(() => import('./pages/ItemPicker'));
const Templates = lazy(() => import('./pages/Templates'));
const TemplateEditor = lazy(() => import('./pages/TemplateEditor'));
const BankAccounts = lazy(() => import('./pages/BankAccounts'));

function suspense(element) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

export function AppRoutes() {
  return useRoutes([
    {
      path: '/',
      element: suspense(<RootLayout />),
      children: [
        { index: true, element: suspense(<Invoices />) },
        { path: 'invoices/new', element: suspense(<InvoiceForm />) },
        { path: 'invoices/:id', element: suspense(<InvoiceView />) },
        { path: 'invoices/:id/edit', element: suspense(<InvoiceEdit />) },
        { path: 'items', element: suspense(<Items />) },
        { path: 'items/new', element: suspense(<ItemForm />) },
        { path: 'items/:id', element: suspense(<ItemView />) },
        { path: 'items/:id/edit', element: suspense(<ItemForm />) },
        { path: 'clients', element: suspense(<Clients />) },
        { path: 'clients/new', element: suspense(<ClientForm />) },
        { path: 'clients/:id', element: suspense(<ClientView />) },
        { path: 'clients/:id/edit', element: suspense(<ClientForm />) },
        { path: 'templates', element: suspense(<Templates />) },
        { path: 'templates/:documentType/:templateId/edit', element: suspense(<TemplateEditor />) },
        { path: 'bank-accounts', element: suspense(<BankAccounts />) },
        { path: 'more', element: suspense(<More />) }
      ]
    },
    { path: '/welcome', element: suspense(<Welcome />) },
    { path: '/login', element: suspense(<Login />) },
    { path: '/pick/customer', element: suspense(<CustomerPickerPage />) },
    { path: '/pick/item', element: suspense(<ItemPickerPage />) },
    { path: '*', element: <Navigate to="/welcome" replace /> }
  ]);
}
