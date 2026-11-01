import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LangProvider } from './i18n';
import { AppLayout, Guard, PublicLayout } from './components/ui';
import {
  About, Contact, How, Landing, Login, Marketplace, Privacy, ProductDetail, Products,
  PublicBatch, PublicPassport, Register, SchemeDetail, Schemes, Terms,
} from './pages/PublicPages';
import {
  AdminArea, AssistantPage, BatchDesk, BatchList, BuyerMarket, BuyersPage, CentreArea,
  Dashboard, NewBatch, OffersPage, OrdersPage, ProfilePage, RequirementForm, RequirementMatches,
} from './pages/AppPages';

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route index element={<Landing />} />
              <Route path="about" element={<About />} />
              <Route path="how-it-works" element={<How />} />
              <Route path="marketplace" element={<Marketplace />} />
              <Route path="marketplace/:batchId" element={<PublicBatch />} />
              <Route path="passport/:batchId" element={<PublicPassport />} />
              <Route path="schemes" element={<Schemes />} />
              <Route path="schemes/:schemeId" element={<SchemeDetail />} />
              <Route path="products" element={<Products />} />
              <Route path="products/:productId" element={<ProductDetail />} />
              <Route path="contact" element={<Contact />} />
              <Route path="privacy" element={<Privacy />} />
              <Route path="terms" element={<Terms />} />
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
            </Route>

            <Route element={<Guard roles={['collector']} />}>
              <Route element={<AppLayout />}>
                <Route path="collector/dashboard" element={<Dashboard />} />
                <Route path="collector/batches" element={<BatchList />} />
                <Route path="collector/batches/new" element={<NewBatch />} />
                <Route path="collector/batches/:batchId" element={<BatchDesk />} />
                <Route path="collector/batches/:batchId/edit" element={<BatchDesk />} />
                <Route path="collector/passports" element={<BatchList />} />
                <Route path="collector/buyers" element={<BuyersPage />} />
                <Route path="collector/buyers/:id" element={<RequirementMatches />} />
                <Route path="collector/offers" element={<OffersPage />} />
                <Route path="collector/schemes" element={<Schemes />} />
                <Route path="collector/assistant" element={<AssistantPage />} />
                <Route path="collector/profile" element={<ProfilePage />} />
              </Route>
            </Route>

            <Route element={<Guard roles={['buyer']} />}>
              <Route element={<AppLayout />}>
                <Route path="buyer/dashboard" element={<Dashboard />} />
                <Route path="buyer/marketplace" element={<BuyerMarket />} />
                <Route path="buyer/marketplace/:batchId" element={<BatchDesk roleBase="/buyer/marketplace" />} />
                <Route path="buyer/requirements" element={<BuyersPage />} />
                <Route path="buyer/requirements/new" element={<RequirementForm />} />
                <Route path="buyer/requirements/:id" element={<RequirementMatches />} />
                <Route path="buyer/offers" element={<OffersPage />} />
                <Route path="buyer/orders" element={<OrdersPage />} />
                <Route path="buyer/orders/:orderId" element={<OrdersPage />} />
                <Route path="buyer/transactions" element={<OrdersPage />} />
                <Route path="buyer/profile" element={<ProfilePage />} />
              </Route>
            </Route>

            <Route element={<Guard roles={['inspector']} />}>
              <Route element={<AppLayout />}>
                <Route path="inspector/dashboard" element={<Dashboard />} />
                <Route path="inspector/queue" element={<BatchList base="/inspector/batches" />} />
                <Route path="inspector/batches/:batchId" element={<BatchDesk roleBase="/inspector/queue" />} />
                <Route path="inspector/history" element={<BatchList base="/inspector/batches" />} />
              </Route>
            </Route>

            <Route element={<Guard roles={['centre']} />}>
              <Route element={<AppLayout />}>
                <Route path="centre/batches/new" element={<NewBatch />} />
                <Route path="centre/batches/:batchId" element={<BatchDesk roleBase="/centre/batches" />} />
                <Route path="centre/*" element={<CentreArea />} />
              </Route>
            </Route>

            <Route element={<Guard roles={['admin']} />}>
              <Route element={<AppLayout />}>
                <Route path="admin/*" element={<AdminArea />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LangProvider>
  );
}
