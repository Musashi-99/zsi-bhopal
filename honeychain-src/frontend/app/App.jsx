import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppShell from './components/layout/AppShell';
import { LoadingState } from './components/ui/primitives';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import MyBatches from './pages/MyBatches';
import CreateBatch from './pages/CreateBatch';
import Passport from './pages/Passport';
import QualityPrice from './pages/QualityPrice';
import Buyers from './pages/Buyers';
import PostHarvest from './pages/PostHarvest';
import Rejections from './pages/Rejections';
import Audit from './pages/Audit';
import Schemes from './pages/Schemes';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';
import CollectorOnly from './pages/CollectorOnly';
import OfficerShell from './components/layout/OfficerShell';
import OfficerOverview from './pages/officer/OfficerOverview';
import OfficerSoon from './pages/officer/OfficerSoon';
import OfficerVerification from './pages/officer/OfficerVerification';
import OfficerBatchDetail from './pages/officer/OfficerBatchDetail';
import { OfficerQualityBatch, OfficerQualityHome } from './pages/officer/OfficerQuality';
import { OfficerCentreDetail, OfficerCentres } from './pages/officer/OfficerCentres';
import { OfficerCollectorDetail, OfficerCollectors } from './pages/officer/OfficerCollectors';
import OfficerMarket from './pages/officer/OfficerMarket';
import OfficerSchemes from './pages/officer/OfficerSchemes';
import OfficerReports from './pages/officer/OfficerReports';
import { OfficerAudit, OfficerOfficers, OfficerSettings } from './pages/officer/OfficerAdmin';

import { homeFor, isOfficer, isSeller } from './lib/roles';
import MarketShell from './components/market/MarketShell';
import MarketHome from './pages/market/MarketHome';
import Products from './pages/market/Products';
import Categories from './pages/market/Categories';
import ProductDetail from './pages/market/ProductDetail';
import MarketVerify from './pages/market/Verify';
import { CentreDetail, Centres } from './pages/market/Centres';
import { Catalogue, CatalogueDetail } from './pages/market/Catalogue';
import { About, HowItWorks } from './pages/market/Info';
import MarketLogin from './pages/market/MarketLogin';
import Basket from './pages/market/Basket';
import { AccountHome, AccountLayout, AccountProfile, Enquiries, Orders, Saved, Verifications, Viewed } from './pages/market/Account';
import SellerDesk from './pages/SellerDesk';

function LegacyVerify() {
  const { code } = useParams();
  return <Navigate to={code ? `/market/verify/${encodeURIComponent(code)}` : '/market/verify'} replace />;
}

function DashboardGate() {
  const { user } = useAuth();
  if (isOfficer(user)) return <Navigate to="/officer/overview" replace />;
  if (user.role === 'buyer') return <Navigate to="/market" replace />;
  return <Dashboard />;
}

function SellerGate() {
  const { user } = useAuth();
  if (!isSeller(user) || isOfficer(user)) return <Navigate to={homeFor(user)} replace />;
  return <SellerDesk />;
}

function OfficerOnly({ children }) {
  const { user } = useAuth();
  return isOfficer(user) ? children : <Navigate to="/dashboard" replace />;
}

function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="boot"><LoadingState rows={4} label="Starting" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

function Collector({ children }) {
  const { user } = useAuth();
  return user.role === 'collector' ? children : <CollectorOnly />;
}

function PublicOnly({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return user ? <Navigate to={homeFor(user)} replace /> : children;
}

export default function App() {
  const wrap = (el) => <Collector>{el}</Collector>;
  return (
    <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
        <Route path="/verify" element={<LegacyVerify />} />
        <Route path="/verify/:code" element={<LegacyVerify />} />

        <Route element={<MarketShell />}>
          <Route path="/market" element={<MarketHome />} />
          <Route path="/market/products" element={<Products />} />
          <Route path="/market/categories" element={<Categories />} />
          <Route path="/market/p/:code" element={<ProductDetail />} />
          <Route path="/market/verify" element={<MarketVerify />} />
          <Route path="/market/verify/:code" element={<MarketVerify />} />
          <Route path="/market/centres" element={<Centres />} />
          <Route path="/market/centres/:id" element={<CentreDetail />} />
          <Route path="/market/catalogue" element={<Catalogue />} />
          <Route path="/market/catalogue/:id" element={<CatalogueDetail />} />
          <Route path="/market/how-it-works" element={<HowItWorks />} />
          <Route path="/market/about" element={<About />} />
          <Route path="/market/login" element={<MarketLogin />} />
          <Route path="/market/basket" element={<Basket />} />
          <Route path="/market/account" element={<AccountLayout />}>
            <Route index element={<AccountHome />} />
            <Route path="enquiries" element={<Enquiries />} />
            <Route path="orders" element={<Orders />} />
            <Route path="saved" element={<Saved />} />
            <Route path="viewed" element={<Viewed />} />
            <Route path="verifications" element={<Verifications />} />
            <Route path="profile" element={<AccountProfile />} />
          </Route>
        </Route>

        <Route element={<RequireAuth><OfficerOnly><OfficerShell /></OfficerOnly></RequireAuth>}>
          <Route path="/officer" element={<Navigate to="/officer/overview" replace />} />
          <Route path="/officer/overview" element={<OfficerOverview />} />
          <Route path="/officer/verification" element={<OfficerVerification />} />
          <Route path="/officer/verification/:id" element={<OfficerBatchDetail />} />
          <Route path="/officer/quality" element={<OfficerQualityHome />} />
          <Route path="/officer/quality/:id" element={<OfficerQualityBatch />} />
          <Route path="/officer/centres" element={<OfficerCentres />} />
          <Route path="/officer/centres/:id" element={<OfficerCentreDetail />} />
          <Route path="/officer/collectors" element={<OfficerCollectors />} />
          <Route path="/officer/collectors/:id" element={<OfficerCollectorDetail />} />
          <Route path="/officer/market" element={<OfficerMarket />} />
          <Route path="/officer/schemes" element={<OfficerSchemes />} />
          <Route path="/officer/reports" element={<OfficerReports />} />
          <Route path="/officer/audit" element={<OfficerAudit />} />
          <Route path="/officer/officers" element={<OfficerOfficers />} />
          <Route path="/officer/settings" element={<OfficerSettings />} />
          <Route path="/officer/*" element={<OfficerSoon />} />
        </Route>

        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/dashboard" element={<DashboardGate />} />
          <Route path="/batches" element={wrap(<MyBatches />)} />
          <Route path="/batches/new" element={wrap(<CreateBatch />)} />
          <Route path="/batches/:id/edit" element={wrap(<CreateBatch />)} />
          <Route path="/passport" element={wrap(<Passport />)} />
          <Route path="/passport/:id" element={wrap(<Passport />)} />
          <Route path="/quality-price" element={wrap(<QualityPrice />)} />
          <Route path="/quality-price/:id" element={wrap(<QualityPrice />)} />
          <Route path="/buyers" element={<Buyers />} />
          <Route path="/post-harvest" element={wrap(<PostHarvest />)} />
          <Route path="/post-harvest/:id" element={wrap(<PostHarvest />)} />
          <Route path="/rejections" element={wrap(<Rejections />)} />
          <Route path="/rejections/:id" element={wrap(<Rejections />)} />
          <Route path="/audit" element={wrap(<Audit />)} />
          <Route path="/schemes" element={<Schemes />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/marketplace" element={<SellerGate />} />
        </Route>
        <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
