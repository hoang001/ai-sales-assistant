import google.generativeai as genai
from .config import settings
from .tools import defined_tools
from .prompts import sales_system_instruction


class AgentManager:
    def __init__(self):
        # Không khởi tạo ngay để tránh lỗi import
        self.model = None
        self.sessions = {}

    def ask(self, prompt: str) -> str:
        """
        Wrapper đơn giản để service dùng.
        Không stream, không tool.
        """
        return self.get_response(user_id="system", message=prompt)

    def _initialize_model(self):
        if self.model is None:
            if not settings.GEMINI_API_KEY:
                raise ValueError("Chưa cấu hình GEMINI_API_KEY")

            genai.configure(api_key=settings.GEMINI_API_KEY)

            generation_config = {
                "temperature": 0,
                "top_p": 1,
                "max_output_tokens": 8192,
            }

            self.model = genai.GenerativeModel(
                model_name="gemini-2.5-flash-lite",
                tools=defined_tools,
                generation_config=generation_config,
                system_instruction=sales_system_instruction,
            )

    def get_response(self, user_id: str, message: str):
        try:
            self._initialize_model()

            if user_id not in self.sessions:
                self.sessions[user_id] = self.model.start_chat(
                    history=[], enable_automatic_function_calling=True
                )

            chat = self.sessions[user_id]
            print(f"DEBUG: Sending message to AI: '{message}'")
            response = chat.send_message(message)
            print(f"DEBUG: AI response text length: {len(response.text)}")
            print(f"DEBUG: AI response preview: {response.text[:200]}")
            return response.text

        except Exception as e:
            print(f"❌ LỖI AGENT: {e}")
            if user_id in self.sessions:
                del self.sessions[user_id]
            return f"⚠️ Lỗi xử lý: {str(e)}"


agent_manager = AgentManager()
