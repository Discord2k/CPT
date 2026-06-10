import { SessionProvider } from './contexts/SessionContext';
import { SessionGate } from './components/SessionGate';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';

function AppContent() {
  return (
    <div className="min-h-screen bg-cream-100 flex flex-col">
      <Header />

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Banner with Title */}
        <div className="bg-sand-50 border border-sand-200 p-5 rounded-lg shadow-sm mb-6">
          <h2 className="text-xl font-bold text-forest-800 font-mono tracking-tight uppercase">
            Volunteer Registry & Evaluations
          </h2>
          <p className="text-xs text-sand-600 font-sans mt-0.5">
            Review rosters, assign convention departments, and enter volunteer ratings globally or by session.
          </p>
        </div>

        {/* Dashboard Grid & List */}
        <Dashboard />

      </main>

      <footer className="bg-sand-50 border-t border-sand-200 py-6 font-mono text-[10px] text-sand-500 text-center">
        <div>CPT CO-ORDINATION ENGINE — SECURE REGIONAL DATA SYSTEM</div>
        <div className="mt-1 opacity-75">All data transfers encrypted. Service worker caching active.</div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <SessionProvider>
      <SessionGate>
        <AppContent />
      </SessionGate>
    </SessionProvider>
  );
}

export default App;
