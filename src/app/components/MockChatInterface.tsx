import React from 'react';

const MockChatInterface = () => {
    return (
        <div className="w-full h-full flex flex-col justify-center p-6 gap-4 bg-transparent">
            {/* User Message */}
            <div className="flex justify-end w-full animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-forwards">
                <div className="bg-[#2A2A2A] text-white/90 px-5 py-3 rounded-2xl rounded-tr-sm max-w-[85%] text-[0.92rem] leading-relaxed shadow-lg border border-white/10 relative group">
                    I didn't do the work today.
                </div>
            </div>

            {/* Gray Message */}
            <div className="flex justify-start w-full animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-forwards">
                <div className="bg-gradient-to-br from-[#FFB24C]/15 to-[#88B5FF]/5 text-[#FFD3AD] px-5 py-3 rounded-2xl rounded-tl-sm max-w-[90%] text-[0.92rem] leading-relaxed shadow-lg border border-[#FFD696]/20 backdrop-blur-md relative">
                    <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-[#FFB24C] opacity-50 blur-[2px]"></div>
                    I noticed the pattern. Let's fix the context...
                </div>
            </div>
        </div>
    );
};

export default MockChatInterface;
