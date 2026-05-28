export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6">
      
      <div className="max-w-md w-full text-center">
        
        <h1 className="text-5xl font-bold mb-4">
          PanicPrep
        </h1>

        <p className="text-zinc-400 text-lg mb-10">
          Snap your homework. Understand it instantly.
        </p>

        <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
          
          <div className="border-2 border-dashed border-zinc-700 rounded-2xl p-10 hover:border-white transition">
            
            <p className="text-zinc-400">
              Upload worksheet or homework image
            </p>

          </div>

          <div className="grid grid-cols-2 gap-3 mt-6">
            
            <button className="bg-white text-black rounded-2xl py-4 font-semibold hover:scale-105 transition">
              Explain
            </button>

            <button className="bg-zinc-800 rounded-2xl py-4 hover:bg-zinc-700 transition">
              Simplify
            </button>

            <button className="bg-zinc-800 rounded-2xl py-4 hover:bg-zinc-700 transition">
              Summarize
            </button>

            <button className="bg-zinc-800 rounded-2xl py-4 hover:bg-zinc-700 transition">
              Quiz Me
            </button>

          </div>

        </div>

      </div>

    </main>
  );
}