import logo from "../assets/logo.png";

const EmptyChatState = () => (
  <div className="flex flex-col items-center justify-center h-[60%] pt-48 text-center px-4">
    <img src={logo} alt="Chat" className="mb-4 h-16" />
    <h2 className="text-xl font-semibold mb-2 font-apple text-gray-700">
      Notechat
    </h2>
    <p className="text-gray-500 font-apple max-w-md mb-8">
      Start a conversation with your Apple Notes by typing a message below.
    </p>
  </div>
);

export default EmptyChatState;
