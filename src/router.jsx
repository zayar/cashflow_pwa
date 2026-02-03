import React from 'react';
import { useRoutes, Navigate } from 'react-router-dom';
import RootLayout from './layout/RootLayout';
import Welcome from './pages/Welcome';
import Invoices from './pages/Invoices';
import Items from './pages/Items';
import Clients from './pages/Clients';
import More from './pages/More';
import Login from './pages/Login';
import InvoiceForm from './pages/InvoiceForm';
import ItemForm from './pages/ItemForm';
import ClientForm from './pages/ClientForm';
import CustomerPickerPage from './pages/CustomerPicker';
import ItemPickerPage from './pages/ItemPicker';

export function AppRoutes() {
  return useRoutes([
    {
      path: '/',
      element: <RootLayout />,
      children: [
        { index: true, element: <Invoices /> },
        { path: 'invoices/new', element: <InvoiceForm /> },
        { path: 'items', element: <Items /> },
        { path: 'items/new', element: <ItemForm /> },
        { path: 'clients', element: <Clients /> },
        { path: 'clients/new', element: <ClientForm /> },
        { path: 'more', element: <More /> }
      ]
    },
    { path: '/welcome', element: <Welcome /> },
    { path: '/login', element: <Login /> },
    { path: '/pick/customer', element: <CustomerPickerPage /> },
    { path: '/pick/item', element: <ItemPickerPage /> },
    { path: '*', element: <Navigate to="/welcome" replace /> }
  ]);
}
